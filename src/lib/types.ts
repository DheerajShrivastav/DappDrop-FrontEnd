export type TaskType = 'SOCIAL_FOLLOW' | 'JOIN_DISCORD' | 'RETWEET' | 'ONCHAIN_TX';

export type Task = {
  id: string;
  type: TaskType;
  description: string;
};

export type UserTask = {
  taskId: string;
  completed: boolean;
  isCompleting?: boolean;
};

export type Reward = {
    type: 'ERC20' | 'ERC721';
    tokenAddress: string;
    amount?: string;
    name: string;
};

export type Campaign = {
  id: string;
  title: string;
  description: string; // This is the short description
  longDescription: string;
  startDate: Date;
  endDate: Date;
  status: 'Draft' | 'Active' | 'Ended';
  participants: number;
  host: string;
  tasks: Task[];
  reward: Reward;
  imageUrl: string;
  'data-ai-hint'?: string;
};
