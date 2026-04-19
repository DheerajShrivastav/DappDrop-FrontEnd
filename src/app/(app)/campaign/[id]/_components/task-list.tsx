'use client'

import { motion } from 'framer-motion'
import {
  CheckCircle,
  Twitter,
  MessageSquare,
  Bot,
  ShieldCheck,
} from 'lucide-react'

import type { Campaign, UserTask, Task as TaskType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

const TaskIcon = ({ type }: { type: TaskType['type'] }) => {
  switch (type) {
    case 'SOCIAL_FOLLOW':
      return <Twitter className="h-5 w-5 text-primary" />
    case 'JOIN_DISCORD':
      return <MessageSquare className="h-5 w-5 text-indigo-600" />
    case 'JOIN_TELEGRAM':
      return <Bot className="h-5 w-5 text-blue-600" />
    case 'RETWEET':
      return <Twitter className="h-5 w-5 text-primary" />
    case 'ONCHAIN_TX':
      return <ShieldCheck className="h-5 w-5 text-green-600" />
    case 'HUMANITY_VERIFICATION':
      return <ShieldCheck className="h-5 w-5 text-purple-600" />
    default:
      return <Bot className="h-5 w-5 text-muted-foreground" />
  }
}

interface TaskListProps {
  campaign: Campaign
  userTasks: UserTask[]
  role: string | null
  onOpenVerifyDialog: (taskId: string, taskType: TaskType['type']) => void
}

export function TaskList({
  campaign,
  userTasks,
  role,
  onOpenVerifyDialog,
}: TaskListProps) {
  const completedTasksCount = userTasks.filter((ut) => ut.completed).length
  const progressPercentage = (completedTasksCount / campaign.tasks.length) * 100

  return (
    <>
      {/* Progress Card */}
      {role === 'participant' && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <Card className="card-modern">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-headline font-semibold text-lg">
                    Your Progress
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {completedTasksCount} of {campaign.tasks.length} tasks
                    completed
                  </p>
                </div>
                <div className="text-3xl font-bold text-primary">
                  {Math.round(progressPercentage)}%
                </div>
              </div>
              <Progress value={progressPercentage} className="h-3" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tasks List */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      >
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="font-headline">Tasks to Complete</CardTitle>
            <CardDescription>
              Complete all tasks to be eligible for rewards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaign.tasks.map((task, index) => {
              const userTask = userTasks.find((ut) => ut.taskId === task.id)
              const isCompleted = userTask?.completed

              return (
                <motion.div
                  key={task.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isCompleted
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-slate-200 hover:border-primary hover:shadow-card'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-lg ${isCompleted ? 'bg-green-100' : 'bg-slate-100'}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <TaskIcon type={task.type} />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{task.description}</h4>
                      {task.type === 'ONCHAIN_TX' &&
                        task.metadata?.paymentRequired && (
                          <Badge variant="outline" className="text-xs">
                            💰 {task.metadata.amountDisplay} on{' '}
                            {task.metadata.network}
                          </Badge>
                        )}
                    </div>
                    {role === 'participant' &&
                      !isCompleted &&
                      campaign.status === 'Open' && (
                        <Button
                          size="sm"
                          className="shimmer"
                          onClick={() =>
                            onOpenVerifyDialog(task.id, task.type)
                          }
                        >
                          Verify
                        </Button>
                      )}
                    {isCompleted && (
                      <Badge className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Done
                      </Badge>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
