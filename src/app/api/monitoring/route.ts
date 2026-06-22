import { AgentRunController } from '@/lib/controllers/AgentRunController'

export const GET  = AgentRunController.list.bind(AgentRunController)
export const POST = AgentRunController.create.bind(AgentRunController)
