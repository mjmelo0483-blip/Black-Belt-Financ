
export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  account: string;
  status: 'Confirmed' | 'Pending';
  type: 'Income' | 'Expense' | 'Transfer';
  amount: number;
}

export interface Account {
  id: string;
  name: string;
  type: 'Checking' | 'Savings' | 'Investments' | 'Wallet';
  balance: number;
  color: string;
  institution: string;
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
