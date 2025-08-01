import { addDays, subDays } from 'date-fns';
import type { Campaign } from './types';

const now = new Date();

// This file is no longer the source of truth for campaign data,
// but can be kept for reference or testing purposes.
export const campaigns: Campaign[] = [];
