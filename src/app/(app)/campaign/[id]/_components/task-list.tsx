'use client'

import { motion } from 'framer-motion'
import {
  CheckCircle,
  Twitter,
  MessageSquare,
  Bot,
  ShieldCheck,
  AlertTriangle,
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

// Task-type icons are categorical, not status — kept neutral/monochrome (icon shape
// alone communicates the type; color is reserved for lifecycle/money state).
const TaskIcon = ({ type }: { type: TaskType['type'] }) => {
  switch (type) {
    case 'SOCIAL_FOLLOW':
    case 'RETWEET':
      return <Twitter className="h-5 w-5 text-foreground/70" />
    case 'JOIN_DISCORD':
      return <MessageSquare className="h-5 w-5 text-foreground/70" />
    case 'JOIN_TELEGRAM':
      return <Bot className="h-5 w-5 text-foreground/70" />
    case 'ONCHAIN_TX':
    case 'HUMANITY_VERIFICATION':
      return <ShieldCheck className="h-5 w-5 text-foreground/70" />
    default:
      return <Bot className="h-5 w-5 text-muted-foreground" />
  }
}

interface TaskListProps {
  campaign: Campaign
  userTasks: UserTask[]
  role: string | null
  isTimeExpiredNotClosed?: boolean
  onOpenVerifyDialog: (taskId: string, taskType: TaskType['type']) => void
}

export function TaskList({
  campaign,
  userTasks,
  role,
  isTimeExpiredNotClosed,
  onOpenVerifyDialog,
}: TaskListProps) {
  const completedTasksCount = userTasks.filter((ut) => ut.completed).length
  const progressPercentage = (completedTasksCount / campaign.tasks.length) * 100

  return (
    <>
      {/* Expired-but-not-closed warning banner */}
      {isTimeExpiredNotClosed && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex items-start gap-3 p-4 rounded-xl border border-status-pending-border bg-status-pending-bg text-status-pending-fg"
        >
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Campaign end time has passed</p>
            <p className="text-sm mt-0.5 opacity-90">
              This campaign has passed its end date but has not been officially
              closed on-chain by the creator. Task interactions are disabled
              until the campaign is closed.
            </p>
          </div>
        </motion.div>
      )}

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
                  className={`p-4 rounded-xl border transition-all ${
                    isCompleted
                      ? 'bg-status-claimable-bg border-status-claimable-border'
                      : 'bg-card border-border hover:border-foreground/20 hover:shadow-card'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-lg ${isCompleted ? 'bg-status-claimable-solid/10' : 'bg-secondary'}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-status-claimable-fg" />
                      ) : (
                        <TaskIcon type={task.type} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{task.description}</h4>
                        {task.type === 'ONCHAIN_TX' && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5 font-semibold text-muted-foreground"
                          >
                            Beta
                          </Badge>
                        )}
                      </div>
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
                      campaign.status === 'Open' &&
                      (isTimeExpiredNotClosed ? (
                        <Badge variant="outline" className="border-status-pending-border bg-status-pending-bg text-status-pending-fg">
                          Expired
                        </Badge>
                      ) : campaign.participants >= 1000 ? (
                        <Badge variant="destructive">
                          Campaign Full
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => onOpenVerifyDialog(task.id, task.type)}
                        >
                          Verify
                        </Button>
                      ))}
                    {isCompleted && (
                      <Badge className="bg-status-claimable-solid text-white border-transparent">
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
