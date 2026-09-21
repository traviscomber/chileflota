import { NextRequest, NextResponse } from 'next/server'
import {
  sendEmailNotification,
  sendSmsNotification,
  createNotificationJob,
  NOTIFICATION_TEMPLATES,
} from '@/lib/notifications-service'
import {
  buildNotificationIdempotencyKey,
  getNotificationDeliveryCapability,
  type NotificationDeliveryType,
} from '@/lib/notification-delivery-safety'
import { protectedEndpoint, type UserRole } from '@/lib/auth-middleware'

const NOTIFICATION_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'administrador',
  'ejecutiva',
]

const NOTIFICATION_TYPES = new Set<NotificationDeliveryType>(['email', 'sms', 'both'])

export async function POST(request: NextRequest) {
  return protectedEndpoint(
    request,
    async (_user, protectedRequest) => {
      try {
        const body = await protectedRequest.json()
        const {
          user_id,
          type,
          template_id,
          variables,
          contact,
        } = body ?? {}

        if (!user_id || typeof user_id !== 'string') {
          return NextResponse.json(
            { error: 'user_id is required', success: false },
            { status: 400 }
          )
        }

        if (!NOTIFICATION_TYPES.has(type)) {
          return NextResponse.json(
            { error: 'Invalid notification type', success: false },
            { status: 400 }
          )
        }

        if (!template_id || !NOTIFICATION_TEMPLATES[template_id]) {
          return NextResponse.json(
            { error: 'Template not found', success: false },
            { status: 400 }
          )
        }

        if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
          return NextResponse.json(
            { error: 'variables must be an object', success: false },
            { status: 400 }
          )
        }

        if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
          return NextResponse.json(
            { error: 'contact must be an object', success: false },
            { status: 400 }
          )
        }

        const template = NOTIFICATION_TEMPLATES[template_id]
        const hasEmail = typeof contact.email === 'string' && contact.email.trim().length > 0
        const hasPhone = typeof contact.phone === 'string' && contact.phone.trim().length > 0

        if ((type === 'email' || type === 'both') && template.type === 'email' && !hasEmail) {
          return NextResponse.json(
            { error: 'Email contact is required for this notification', success: false },
            { status: 400 }
          )
        }

        if ((type === 'sms' || type === 'both') && template.type === 'sms' && !hasPhone) {
          return NextResponse.json(
            { error: 'Phone contact is required for this notification', success: false },
            { status: 400 }
          )
        }

        const delivery = getNotificationDeliveryCapability()
        const idempotencyKey = buildNotificationIdempotencyKey({
          userId: user_id,
          type,
          templateId: template_id,
          variables,
          contact,
        })

        // Fail closed. Until a durable delivery ledger and a real provider adapter
        // are explicitly provisioned, authenticated requests must not create jobs
        // or report a simulated console.log as a successful delivery.
        if (!delivery.ready) {
          return NextResponse.json(
            {
              success: false,
              code: 'NOTIFICATION_DELIVERY_NOT_READY',
              message: 'El canal de entrega está deshabilitado hasta completar ledger, idempotencia y proveedor real.',
              idempotencyKey,
              delivery,
            },
            { status: 503 }
          )
        }

        // This path remains unreachable until a provider is explicitly registered
        // in notification-delivery-safety and the durable ledger is provisioned.
        const job = await createNotificationJob(user_id, template_id, variables, contact)

        if ((type === 'email' || type === 'both') && hasEmail && template.type === 'email') {
          await sendEmailNotification(contact.email, template_id, variables)
        }

        if ((type === 'sms' || type === 'both') && hasPhone && template.type === 'sms') {
          await sendSmsNotification(contact.phone, template_id, variables)
        }

        return NextResponse.json({
          success: true,
          job_id: job.id,
          idempotencyKey,
          message: 'Notificación enviada',
        })
      } catch (error) {
        console.error('Error sending notification:', error)
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Unknown error', success: false },
          { status: 500 }
        )
      }
    },
    NOTIFICATION_ROLES
  )
}

// GET: Obtener plantillas y capacidad real de entrega para roles autorizados.
export async function GET(request: NextRequest) {
  return protectedEndpoint(
    request,
    async (_user, protectedRequest) => {
      try {
        const searchParams = protectedRequest.nextUrl.searchParams
        const type = searchParams.get('type')

        if (type && type !== 'email' && type !== 'sms') {
          return NextResponse.json(
            { error: 'Invalid template type', success: false },
            { status: 400 }
          )
        }

        const templates = Object.values(NOTIFICATION_TEMPLATES).filter(
          (template) => !type || template.type === type
        )

        return NextResponse.json({
          success: true,
          templates,
          delivery: getNotificationDeliveryCapability(),
        })
      } catch (error) {
        console.error('Error fetching templates:', error)
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Unknown error', success: false },
          { status: 500 }
        )
      }
    },
    NOTIFICATION_ROLES
  )
}
