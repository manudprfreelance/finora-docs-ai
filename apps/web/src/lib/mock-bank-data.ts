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

        financialDetails: {
          currency: "EUR",

          originalPrincipal: 240000,

          outstandingPrincipal:
            198742.31,

          annualInterestRate: 3.2,

          startDate: "2022-03-15",

          maturityDate: "2047-03-15",

          paymentFrequency:
            "monthly",

          totalInstallments: 300,

          paidInstallments: 54,

          installmentAmount: 1163.42,
        },
      },

      {
        loanId: "loan-7721",
        loanName: "Personal loan",
        maskedLoanNumber: "•••• 7721",
        loanType: "personal",

        financialDetails: {
          currency: "EUR",

          originalPrincipal: 18000,

          outstandingPrincipal:
            9724.58,

          annualInterestRate: 6.75,

          startDate: "2024-01-10",

          maturityDate: "2029-01-10",

          paymentFrequency:
            "monthly",

          totalInstallments: 60,

          paidInstallments: 32,

          installmentAmount: 354.87,
        },
      },
    ],

    movements: [
      {
        movementId: "movement-001",
        accountId: "account-0236",
        date: "2026-08-02",
        description: "Electricity bill",
        amount: -78.42,
        currency: "EUR",
      },
      {
        movementId: "movement-002",
        accountId: "account-0236",
        date: "2026-08-03",
        description: "Supermarket purchase",
        amount: -64.85,
        currency: "EUR",
      },
      {
        movementId: "movement-003",
        accountId: "account-0236",
        date: "2026-08-05",
        description: "Mobile phone bill",
        amount: -39.99,
        currency: "EUR",
      },
      {
        movementId: "movement-004",
        accountId: "account-0236",
        date: "2026-08-07",
        description: "Restaurant payment",
        amount: -48.6,
        currency: "EUR",
      },
      {
        movementId: "movement-005",
        accountId: "account-0236",
        date: "2026-08-09",
        description: "Online subscription",
        amount: -14.99,
        currency: "EUR",
      },
      {
        movementId: "movement-006",
        accountId: "account-0236",
        date: "2026-08-11",
        description: "Cash withdrawal",
        amount: -120,
        currency: "EUR",
      },
      {
        movementId: "movement-007",
        accountId: "account-0236",
        date: "2026-08-13",
        description: "Fuel station payment",
        amount: -72.35,
        currency: "EUR",
      },
      {
        movementId: "movement-008",
        accountId: "account-0236",
        date: "2026-08-15",
        description: "Home insurance",
        amount: -186.4,
        currency: "EUR",
      },
      {
        movementId: "movement-009",
        accountId: "account-0236",
        date: "2026-08-16",
        description: "Card purchase refund",
        amount: 42.5,
        currency: "EUR",
      },
      {
        movementId: "movement-010",
        accountId: "account-0236",
        date: "2026-08-18",
        description: "Salary payment",
        amount: 3200,
        currency: "EUR",
      },
      {
        movementId: "movement-011",
        accountId: "account-0236",
        date: "2026-08-20",
        description: "International transfer to ACME GmbH",
        amount: -2500,
        currency: "EUR",

        swiftDetails: {
          uetr:
            "8f2c1a46-7d33-4c8f-9a4e-1c8e61a24f01",

          transactionReference:
            "FIN-SWIFT-20260820-001",

          orderingCustomerName:
            "Carlos García López",

          orderingAccount:
            "•••• 0236",

          beneficiaryName:
            "ACME GmbH",

          beneficiaryIban:
            "DE89370400440532013000",

          beneficiaryBankName:
            "Deutsche Bank AG",

          beneficiaryBankBic:
            "DEUTDEFFXXX",

          beneficiaryBankCountry:
            "Germany",

          remittanceInformation:
            "Payment of invoice ACME-2026-0817",

          valueDate:
            "2026-08-20",

          charges:
            "SHA",

          transferStatus:
            "settled",
        },
      },
      {
        movementId: "movement-012",
        accountId: "account-0236",
        date: "2026-08-22",
        description: "Credit card settlement",
        amount: -426.73,
        currency: "EUR",
      },
      {
        movementId: "movement-013",
        accountId: "account-0236",
        date: "2026-08-24",
        description: "Water utility bill",
        amount: -31.25,
        currency: "EUR",
      },
      {
        movementId: "movement-014",
        accountId: "account-0236",
        date: "2026-08-26",
        description: "SEPA transfer received",
        amount: 275,
        currency: "EUR",
      },
      {
        movementId: "movement-015",
        accountId: "account-0236",
        date: "2026-08-27",
        description:
          "Streaming service subscription",
        amount: -12.99,
        currency: "EUR",
      },
      {
        movementId: "movement-016",
        accountId: "account-0236",
        date: "2026-08-29",
        description: "Pharmacy purchase",
        amount: -23.8,
        currency: "EUR",
      },
      {
        movementId: "movement-017",
        accountId: "account-0236",
        date: "2026-08-30",
        description: "Bank service fee",
        amount: -6,
        currency: "EUR",
      },

      {
        movementId: "movement-018",
        accountId: "account-8174",
        date: "2026-08-04",
        description:
          "Investment fund distribution",
        amount: 185.75,
        currency: "EUR",
      },
      {
        movementId: "movement-019",
        accountId: "account-8174",
        date: "2026-08-15",
        description:
          "Investment subscription",
        amount: -5000,
        currency: "EUR",
      },
      {
        movementId: "movement-020",
        accountId: "account-8174",
        date: "2026-08-28",
        description: "Dividend payment",
        amount: 92.4,
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

        financialDetails: {
          currency: "EUR",

          originalPrincipal: 12000,

          outstandingPrincipal:
            6431.72,

          annualInterestRate: 5.9,

          startDate: "2024-06-05",

          maturityDate: "2028-06-05",

          paymentFrequency:
            "monthly",

          totalInstallments: 48,

          paidInstallments: 27,

          installmentAmount: 281.36,
        },
      },
    ],

    movements: [
      {
        movementId: "movement-021",
        accountId: "account-4412",
        date: "2026-08-01",
        description: "Rent payment",
        amount: -950,
        currency: "EUR",
      },
      {
        movementId: "movement-022",
        accountId: "account-4412",
        date: "2026-08-04",
        description: "Supermarket purchase",
        amount: -72.18,
        currency: "EUR",
      },
      {
        movementId: "movement-023",
        accountId: "account-4412",
        date: "2026-08-07",
        description: "Electricity bill",
        amount: -65.7,
        currency: "EUR",
      },
      {
        movementId: "movement-024",
        accountId: "account-4412",
        date: "2026-08-10",
        description: "Online shopping",
        amount: -118.3,
        currency: "EUR",
      },
      {
        movementId: "movement-025",
        accountId: "account-4412",
        date: "2026-08-12",
        description: "Salary payment",
        amount: 2850,
        currency: "EUR",
      },
      {
        movementId: "movement-026",
        accountId: "account-4412",
        date: "2026-08-15",
        description: "Cash withdrawal",
        amount: -100,
        currency: "EUR",
      },
      {
        movementId: "movement-027",
        accountId: "account-4412",
        date: "2026-08-18",
        description: "Insurance premium",
        amount: -96.25,
        currency: "EUR",
      },
      {
        movementId: "movement-028",
        accountId: "account-4412",
        date: "2026-08-19",
        description: "Card payment",
        amount: -84.5,
        currency: "EUR",
      },
      {
        movementId: "movement-029",
        accountId: "account-4412",
        date: "2026-08-22",
        description:
          "International transfer to Global Supplies Ltd.",
        amount: -1200,
        currency: "EUR",

        swiftDetails: {
          uetr:
            "49c18f25-cc5d-4d14-8e89-20d7b1f2d804",

          transactionReference:
            "FIN-SWIFT-20260822-002",

          orderingCustomerName:
            "Laura Martínez Ruiz",

          orderingAccount:
            "•••• 4412",

          beneficiaryName:
            "Global Supplies Ltd.",

          beneficiaryIban:
            "GB29NWBK60161331926819",

          beneficiaryBankName:
            "NatWest Bank",

          beneficiaryBankBic:
            "NWBKGB2L",

          beneficiaryBankCountry:
            "United Kingdom",

          remittanceInformation:
            "Payment for commercial supplies",

          valueDate:
            "2026-08-22",

          charges:
            "SHA",

          transferStatus:
            "settled",
        },
      },
      {
        movementId: "movement-030",
        accountId: "account-4412",
        date: "2026-08-25",
        description: "Refund received",
        amount: 64.9,
        currency: "EUR",
      },
      {
        movementId: "movement-031",
        accountId: "account-4412",
        date: "2026-08-28",
        description: "Mobile phone bill",
        amount: -42.9,
        currency: "EUR",
      },
    ],
  },
];

export function findCustomerByDni(
  dni: string,
): MockCustomer | null {
  const normalizedDni =
    dni.trim().toUpperCase();

  return (
    customers.find(
      (customer) =>
        customer.dni.toUpperCase() ===
        normalizedDni,
    ) ?? null
  );
}

export function getCustomerAccounts(
  customerId: string,
): CustomerAccount[] {
  const customer =
    customers.find(
      (item) =>
        item.customerId === customerId,
    );

  return customer?.accounts ?? [];
}

export function getCustomerLoans(
  customerId: string,
): CustomerLoan[] {
  const customer =
    customers.find(
      (item) =>
        item.customerId === customerId,
    );

  return customer?.loans ?? [];
}

export function getCustomerMovements(
  customerId: string,
): BankMovement[] {
  const customer =
    customers.find(
      (item) =>
        item.customerId === customerId,
    );

  return customer?.movements ?? [];
}

export function getMovementsByAccount(
  customerId: string,
  accountId: string,
): BankMovement[] {
  return getCustomerMovements(
    customerId,
  ).filter(
    (movement) =>
      movement.accountId ===
      accountId,
  );
}