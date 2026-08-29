import {
  BankMovement,
  CustomerAccount,
  CustomerLoan,
} from "@/lib/request-types";

export interface MockCustomer {
  customerId: string;
  dni: string;
  name: string;
  accounts: CustomerAccount[];
  loans: CustomerLoan[];
  movements: BankMovement[];
}

const customers: MockCustomer[] = [
  {
    customerId: "customer-001",
    dni: "12345678A",
    name: "Carlos García López",
    accounts: [
      {
        accountId: "account-0236",
        accountName: "Current account",
        maskedAccountNumber: "•••• 0236",
        accountType: "current",
      },
      {
        accountId: "account-8174",
        accountName: "Investment account",
        maskedAccountNumber: "•••• 8174",
        accountType: "investment",
      },
    ],
    loans: [
      {
        loanId: "loan-4401",
        loanName: "Mortgage loan",
        maskedLoanNumber: "•••• 4401",
        loanType: "mortgage",
      },
      {
        loanId: "loan-7721",
        loanName: "Personal loan",
        maskedLoanNumber: "•••• 7721",
        loanType: "personal",
      },
    ],
    movements: [
      {
        movementId: "movement-001",
        accountId: "account-0236",
        date: "2026-08-20",
        description: "International transfer to ACME GmbH",
        amount: -2500,
        currency: "EUR",
      },
      {
        movementId: "movement-002",
        accountId: "account-0236",
        date: "2026-08-18",
        description: "Salary payment",
        amount: 3200,
        currency: "EUR",
      },
      {
        movementId: "movement-003",
        accountId: "account-8174",
        date: "2026-08-15",
        description: "Investment subscription",
        amount: -5000,
        currency: "EUR",
      },
    ],
  },
  {
    customerId: "customer-002",
    dni: "87654321B",
    name: "Laura Martínez Ruiz",
    accounts: [
      {
        accountId: "account-4412",
        accountName: "Current account",
        maskedAccountNumber: "•••• 4412",
        accountType: "current",
      },
    ],
    loans: [
      {
        loanId: "loan-1188",
        loanName: "Personal loan",
        maskedLoanNumber: "•••• 1188",
        loanType: "personal",
      },
    ],
    movements: [
      {
        movementId: "movement-004",
        accountId: "account-4412",
        date: "2026-08-22",
        description: "International transfer to Global Supplies Ltd.",
        amount: -1200,
        currency: "EUR",
      },
      {
        movementId: "movement-005",
        accountId: "account-4412",
        date: "2026-08-19",
        description: "Card payment",
        amount: -84.5,
        currency: "EUR",
      },
    ],
  },
];

export function findCustomerByDni(
  dni: string,
): MockCustomer | null {
  const normalizedDni = dni.trim().toUpperCase();

  return (
    customers.find(
      (customer) =>
        customer.dni.toUpperCase() === normalizedDni,
    ) ?? null
  );
}

export function getCustomerAccounts(
  customerId: string,
): CustomerAccount[] {
  const customer = customers.find(
    (item) => item.customerId === customerId,
  );

  return customer?.accounts ?? [];
}

export function getCustomerLoans(
  customerId: string,
): CustomerLoan[] {
  const customer = customers.find(
    (item) => item.customerId === customerId,
  );

  return customer?.loans ?? [];
}

export function getCustomerMovements(
  customerId: string,
): BankMovement[] {
  const customer = customers.find(
    (item) => item.customerId === customerId,
  );

  return customer?.movements ?? [];
}

export function getMovementsByAccount(
  customerId: string,
  accountId: string,
): BankMovement[] {
  return getCustomerMovements(customerId).filter(
    (movement) => movement.accountId === accountId,
  );
}