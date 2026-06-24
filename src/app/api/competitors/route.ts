import { CompetitorController } from '@/lib/controllers/CompetitorController'

export const GET  = CompetitorController.list.bind(CompetitorController)
export const POST = CompetitorController.create.bind(CompetitorController)
