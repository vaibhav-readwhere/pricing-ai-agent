import { SKUController } from '@/lib/controllers/SKUController'

export const GET    = SKUController.get.bind(SKUController)
export const PATCH  = SKUController.update.bind(SKUController)
export const DELETE = SKUController.remove.bind(SKUController)
