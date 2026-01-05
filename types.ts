
export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  account: string;
  status: 'Confirmed' | 'Pending';
  type: 'Income' | 'Expense' | 'Transfer' | 'Investment';
  amount: number;
  payment_method?: string;
  investment_id?: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'investment' | 'cash' | 'credit';
  balance: number;
  initial_balance_date: string;
  institution?: string;
  color?: string;
  lastDigits?: string;
}

export interface Budget {
  category: string;
  planned: number;
  actual: number;
  icon: string;
}

export interface CreditCard {
  id: string;
  name: string;
  limit: number;
  used: number;
  closingDay: number;
  dueDay: number;
  lastDigits: string;
  color: string;
  brand: 'Visa' | 'Mastercard' | 'Elo';
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  parent_id?: string | null;
  created_at?: string;
}
