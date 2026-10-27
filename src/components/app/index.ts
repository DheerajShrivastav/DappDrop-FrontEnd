/**
 * The app's Monolith primitives (08-site phase 1). Usage and props:
 * landing-studio/08-site/build/primitives.md. Visual QA: /_dev/primitives (dev builds only).
 *
 * Shell pieces (AppHeader, AppFooter, AccountPill) are mounted by src/app/(app)/layout.tsx; pages
 * don't render them.
 */
export { Button, Spinner, buttonClass, type ButtonProps, type ButtonVariant, type ButtonSize } from './button'
export { ClaimActions, type WalletClaimPhase } from './claim-actions'
export { Chip, CampaignStatusChip, PayoutChip, VerificationChip, ExampleChip } from './chip'
export { STATUS_CHIP, statusChip, payoutLabel, payoutShortLabel, VERIFICATION_CHIP, type ChipVariant, type ChipSpec } from './chip-map'
export { Field, Input, Textarea, NativeSelect, InlineError, CharCount, LockedField, ErrorSummary, Segmented, controlClass, type FieldControlProps } from './field'
export { ScheduleField } from './schedule-field'
export { WizardStepper, stepEyebrow, type WizardStep } from './stepper'
export { PageHeader, SectionHeader, PageContainer } from './page-header'
export { Panel, CardLink } from './panel'
export { StatRow, type Stat } from './stat-row'
export { KeyValueList, type KeyValueItem } from './kv-list'
export { Skeleton, LoadingRegion, CardSkeleton, RowsSkeleton, ClaimSkeleton, EmptyState, ErrorState } from './states'
export { ConfirmDialog } from './confirm-dialog'
export { useDocumentTitle } from './document-title'
export { shortAddress, plural } from './format'
export { useTheme } from './use-theme'
export { useToast, toast } from '@/hooks/use-toast'
