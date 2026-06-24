import { SKUController } from '@/lib/controllers/SKUController'

export const GET  = SKUController.list.bind(SKUController)
export const POST = SKUController.create.bind(SKUController)
