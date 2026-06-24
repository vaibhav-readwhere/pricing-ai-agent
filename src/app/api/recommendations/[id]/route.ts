import { RecommendationController } from '@/lib/controllers/RecommendationController'

export const PATCH = RecommendationController.update.bind(RecommendationController)
