import { CustomerAccount } from "@/lib/request-types";

export interface MockCustomer {
  customerId: string;
  dni: string;
  name: string;
  accounts: CustomerAccount[];
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
  },
];

export function findCustomerByDni(
  dni: string,
): MockCustomer | null {
  const normalizedDni = dni.trim().toUpperCase();

  return (
    customers.find(
      (customer) => customer.dni.toUpperCase() === normalizedDni,
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