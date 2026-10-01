export type Account = { id: string; email: string };
export type Income = {
  id: string; incomeDate: string; pointsMinor: number; source: string; note: string;
  createdAt: string; updatedAt: string; version: number;
};
export type IncomeInput = { incomeDate: string; points: string; source: string; note: string; requestId?: string; id?: string; version?: number };
export type MonthSummary = { month: number; pointsMinor: number; count: number };
export type Summary = { year: number; totalMinor: number; count: number; months: MonthSummary[] };
export type RecordPage = { records: Income[]; total: number; page: number; pageSize: number };
export type Filters = { year: number; month?: number; page: number; pageSize: number };
export interface LedgerClient {
  configured: boolean;
  preview: boolean;
  getAccount(): Promise<Account | null>;
  onAccountChange(callback: (account: Account | null) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  list(filters: Filters): Promise<RecordPage>;
  summary(year: number): Promise<Summary>;
  save(input: IncomeInput): Promise<unknown>;
  remove(record: Income): Promise<unknown>;
}
