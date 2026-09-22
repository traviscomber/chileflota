import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return NextResponse.json({
      ok: false,
      problem: "Missing Supabase env vars",
      hasUrl: !!url,
      hasKey: !!key,
      urlLength: url?.length || 0,
      keyLength: key?.length || 0,
    }, { status: 500 })
  }

  try {
    const supabase = createClient(url, key)
    const { error, data } = await supabase
      .from("transportistas")
      .select("id")
      .limit(1)

    if (error) {
      return NextResponse.json({
        ok: false,
        problem: error.message,
        code: error.code,
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      problem: null,
      recordsFound: data?.length || 0,
    }, { status: 200 })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      problem: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 })
  }
}
