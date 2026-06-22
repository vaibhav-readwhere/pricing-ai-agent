import { CompetitorController } from '@/lib/controllers/CompetitorController'

export const PATCH  = CompetitorController.update.bind(CompetitorController)
export const DELETE = CompetitorController.remove.bind(CompetitorController)
