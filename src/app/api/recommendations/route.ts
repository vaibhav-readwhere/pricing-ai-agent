import { RecommendationController } from '@/lib/controllers/RecommendationController'

export const GET = RecommendationController.list.bind(RecommendationController)
