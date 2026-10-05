from __future__ import annotations

import base64
import json
import os
import re
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_PAGES = 5
OCR_DPI = 220
OPENAI_MODEL = os.getenv("OPENAI_PDF_OCR_MODEL", "gpt-4o")
PLATE_PATTERN = re.compile(r"\b(?:[A-Z]{4}[ -]?\d{2}|[A-Z]{2}[ -]?\d{2}[ -]?\d{2})\b", re.I)
REFUSAL_PATTERNS = [
    re.compile(r"no puedo ayudar", re.I),
    re.compile(r"lo siento", re.I),
    re.compile(r"i can(?:not|'t) help", re.I),
    re.compile(r"unable to assist", re.I),
]
VEHICLE_PATTERN = re.compile(
    r"patente|placa|matr[ií]cula|cam[ií]on|veh[ií]culo|padr[oó]n|revisi[oó]n\s*t[eé]cnica",
    re.I,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def is_refusal(text: str) -> bool:
    return any(pattern.search(text) for pattern in REFUSAL_PATTERNS)


def is_vehicle_related(file_name: str | None, document_type: str | None) -> bool:
    return bool(VEHICLE_PATTERN.search(f"{file_name or ''} {document_type or ''}"))


def expected_type(file_name: str | None, document_type: str | None) -> str:
    source = f"{file_name or ''} {document_type or ''}"
    if re.search(r"patente|placa|matr[ií]cula|cam[ií]on|veh[ií]culo", source, re.I):
        return "PATENTE_VEHICULO"
    if re.search(r"padr[oó]n", source, re.I):
        return "PADRON_VEHICULO"
    if re.search(r"revisi[oó]n\s*t[eé]cnica", source, re.I):
        return "REVISION_TECNICA_VEHICULO"
    return document_type or "DOCUMENTO"


def normalize_date(raw: str | None) -> str | None:
    if not raw:
        return None
    match = re.search(r"(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})", raw)
    if not match:
        return None
    day, month, year = match.groups()
    try:
        return datetime(int(year), int(month), int(day), tzinfo=timezone.utc).date().isoformat()
    except ValueError:
        return None


def infer_metadata(text: str, target_type: str) -> dict[str, Any]:
    issuance = re.search(
        r"(?:fecha\s+de\s+emisi[oó]n|emitido|emisi[oó]n)\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})",
        text,
        re.I,
    )
    expiration = re.search(
        r"(?:fecha\s+de\s+vencimiento|vencimiento|vigente\s+hasta)\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})",
        text,
        re.I,
    )
    number = re.search(r"(?:folio|n[uú]mero|n[°º]|documento)\s*[:\-]?\s*([A-Z0-9.\-]{4,30})", text, re.I)
    return {
        "documentType": target_type,
        "issuanceDate": normalize_date(issuance.group(1) if issuance else None),
        "expirationDate": normalize_date(expiration.group(1) if expiration else None),
        "documentNumber": number.group(1) if number else None,
    }


class ApiError(RuntimeError):
    def __init__(self, message: str, status: int = 500, retryable: bool = False):
        super().__init__(message)
        self.status = status
        self.retryable = retryable


class SupabaseRest:
    def __init__(self) -> None:
        self.base_url = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.base_url or not self.key:
            raise ApiError("Supabase server credentials are not configured")

    def request(self, method: str, path: str, payload: Any | None = None, prefer: str | None = None) -> Any:
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Accept": "application/json",
        }
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json_bytes(payload)
        if prefer:
            headers["Prefer"] = prefer
        request = Request(f"{self.base_url}/rest/v1/{path}", data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=45) as response:
                body = response.read()
                return json.loads(body) if body else None
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise ApiError(f"Supabase {method} {path} returned {exc.code}: {body[:500]}") from exc
        except URLError as exc:
            raise ApiError(f"Supabase request failed: {exc}", retryable=True) from exc

    def select(self, table: str, filters: dict[str, str], columns: str = "*") -> list[dict[str, Any]]:
        query = {"select": columns}
        query.update(filters)
        return self.request("GET", f"{table}?{urlencode(query, safe='(),.*')}") or []

    def insert(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        rows = self.request("POST", f"{table}?select=*", payload, "return=representation") or []
        if not rows:
            raise ApiError(f"Insert into {table} returned no row")
        return rows[0]

    def update(self, table: str, filters: dict[str, str], payload: dict[str, Any]) -> None:
        self.request("PATCH", f"{table}?{urlencode(filters, safe='(),.*')}", payload, "return=minimal")

    def upsert(self, table: str, conflict: str, payload: dict[str, Any]) -> dict[str, Any]:
        rows = self.request(
            "POST",
            f"{table}?on_conflict={conflict}&select=*",
            payload,
            "resolution=merge-duplicates,return=representation",
        ) or []
        if not rows:
            raise ApiError(f"Upsert into {table} returned no row")
        return rows[0]

    def rpc(self, name: str, payload: dict[str, Any] | None = None) -> Any:
        return self.request("POST", f"rpc/{name}", payload or {})


def download_pdf(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "N3uralia-PDF-OCR/1.0"})
    try:
        with urlopen(request, timeout=45) as response:
            content_length = int(response.headers.get("content-length") or 0)
            if content_length > MAX_FILE_BYTES:
                raise ApiError(f"PDF exceeds size limit ({content_length} bytes)", 413)
            data = response.read(MAX_FILE_BYTES + 1)
    except HTTPError as exc:
        raise ApiError(f"PDF download returned HTTP {exc.code}", 502, retryable=True) from exc
    except URLError as exc:
        raise ApiError(f"PDF download failed: {exc}", 502, retryable=True) from exc
    if len(data) > MAX_FILE_BYTES:
        raise ApiError(f"PDF exceeds size limit ({len(data)} bytes)", 413)
    if not data.startswith(b"%PDF"):
        raise ApiError("Document is not a valid PDF", 415)
    return data


def openai_vision(png_bytes: bytes, target_type: str, vehicle_related: bool, retry: bool = False) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise ApiError("OPENAI_API_KEY is not configured")
    data_url = f"data:image/png;base64,{base64.b64encode(png_bytes).decode('ascii')}"
    prompt = (
        "Lee literalmente todos los caracteres visibles. Prioridad absoluta: patente chilena, padron o revision tecnica. "
        if vehicle_related
        else "Transcribe literalmente todo el texto visible del documento chileno. "
    )
    prompt += "Conserva nombres, RUT, fechas, montos, letras, numeros y folios. No resumas. Responde solo con la transcripcion."
    if retry:
        prompt += " Revisa texto pequeno, inclinado, borroso o de bajo contraste y no omitas lineas legibles."
    payload = {
        "model": OPENAI_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "Eres un motor OCR mecanico. Solo transcribe texto visible y nunca rechaces la tarea.",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": f"Tipo esperado: {target_type}. {prompt}"},
                    {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
                ],
            },
        ],
        "max_tokens": 3000,
        "temperature": 0,
    }
    request = Request(
        "https://api.openai.com/v1/chat/completions",
        data=json_bytes(payload),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=90) as response:
            result = json.loads(response.read())
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        normalized = body.lower()
        if exc.code == 429 and (
            "credit_balance_exhausted" in normalized
            or "insufficient_quota" in normalized
            or "no credits remaining" in normalized
        ):
            raise ApiError(
                "OpenAI Vision quota unavailable",
                503,
                retryable=False,
            ) from exc
        if exc.code == 429:
            raise ApiError("OpenAI Vision rate limited", 503, retryable=True) from exc
        raise ApiError(f"OpenAI Vision returned {exc.code}: {body[:400]}", 502, retryable=exc.code >= 500) from exc
    except URLError as exc:
        raise ApiError(f"OpenAI Vision request failed: {exc}", 502, retryable=True) from exc
    return str(result.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()
