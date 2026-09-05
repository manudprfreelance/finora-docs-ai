import {
  DocumentProcessingResult,
  DocumentProcessingService,
} from "@/lib/server/document-processing-service";

import {
  DocumentRequest,
  LoanFinancialDetails,
} from "@/lib/request-types";

interface N8nProcessingResponse {
  requestId?: string;
  documentType?: string;
  customerId?: string;
  status?: string;
  processedAt?: string;
  externalReference?: string;
}

interface LoanAmortizationInstallment {
  installmentNumber: number;
  paymentDate: string;
  openingPrincipal: number;
  installmentAmount: number;
  principalAmount: number;
  interestAmount: number;
  closingPrincipal: number;
  currency: string;
}

function roundMoney(
  value: number,
): number {
  return (
    Math.round(
      (value + Number.EPSILON) *
        100,
    ) / 100
  );
}

function addMonths(
  isoDate: string,
  months: number,
): string {
  const [
    year,
    month,
    day,
  ] = isoDate
    .split("-")
    .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1 + months,
        day,
      ),
    );

  return date
    .toISOString()
    .slice(0, 10);
}

function buildLoanAmortizationSchedule(
  financialDetails:
    LoanFinancialDetails,
): LoanAmortizationInstallment[] {
  if (
    financialDetails
      .paymentFrequency !==
    "monthly"
  ) {
    return [];
  }

  const monthlyInterestRate =
    financialDetails
      .annualInterestRate /
    100 /
    12;

  const remainingInstallments =
    Math.max(
      financialDetails
        .totalInstallments -
        financialDetails
          .paidInstallments,
      0,
    );

  let outstandingPrincipal =
    financialDetails
      .outstandingPrincipal;

  const schedule:
    LoanAmortizationInstallment[] =
    [];

  for (
    let index = 0;
    index <
      remainingInstallments;
    index += 1
  ) {
    if (
      outstandingPrincipal <= 0
    ) {
      break;
    }

    const installmentNumber =
      financialDetails
        .paidInstallments +
      index +
      1;

    const paymentDate =
      addMonths(
        financialDetails
          .startDate,
        installmentNumber,
      );

    const openingPrincipal =
      roundMoney(
        outstandingPrincipal,
      );

    const interestAmount =
      roundMoney(
        openingPrincipal *
          monthlyInterestRate,
      );

    let installmentAmount =
      financialDetails
        .installmentAmount;

    let principalAmount =
      roundMoney(
        installmentAmount -
          interestAmount,
      );

    if (
      principalAmount >
      openingPrincipal
    ) {
      principalAmount =
        openingPrincipal;

      installmentAmount =
        roundMoney(
          principalAmount +
            interestAmount,
        );
    }

    if (
      principalAmount <= 0
    ) {
      break;
    }

    const closingPrincipal =
      roundMoney(
        Math.max(
          openingPrincipal -
            principalAmount,
          0,
        ),
      );

    schedule.push({
      installmentNumber,
      paymentDate,
      openingPrincipal,
      installmentAmount:
        roundMoney(
          installmentAmount,
        ),
      principalAmount,
      interestAmount,
      closingPrincipal,
      currency:
        financialDetails
          .currency,
    });

    outstandingPrincipal =
      closingPrincipal;
  }

  return schedule;
}

export class N8nDocumentProcessingService
  implements DocumentProcessingService
{
  async process(
    requestId: string,
    requestState: DocumentRequest,
  ): Promise<DocumentProcessingResult> {
    if (
      requestState.status !==
      "processing"
    ) {
      return {
        requestId,
        status: "failed",
        provider: "n8n",
        externalReference: null,
        output: {},
        error:
          "Only requests in processing state can be processed.",
      };
    }

    const webhookUrl =
      process.env
        .N8N_DOCUMENT_PROCESSING_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        requestId,
        status: "failed",
        provider: "n8n",
        externalReference: null,
        output: {},
        error:
          "N8N_DOCUMENT_PROCESSING_WEBHOOK_URL is not configured.",
      };
    }

    const selectedAccountId =
      requestState.selectedAccount
        ?.accountId ?? null;

    const dateFrom =
      requestState.dateRange?.from ??
      null;

    const dateTo =
      requestState.dateRange?.to ??
      null;

    const accountMovements =
      requestState.availableMovements
        .filter((movement) => {
          if (
            selectedAccountId &&
            movement.accountId !==
              selectedAccountId
          ) {
            return false;
          }

          if (
            dateFrom &&
            movement.date < dateFrom
          ) {
            return false;
          }

          if (
            dateTo &&
            movement.date > dateTo
          ) {
            return false;
          }

          return true;
        })
        .map((movement) => ({
          movementId:
            movement.movementId,

          accountId:
            movement.accountId,

          date:
            movement.date,

          description:
            movement.description,

          amount:
            movement.amount,

          currency:
            movement.currency,
        }));

    const loanFinancialDetails =
      requestState.selectedLoan
        ?.financialDetails ?? null;

    const loanAmortizationSchedule =
      loanFinancialDetails
        ? buildLoanAmortizationSchedule(
            loanFinancialDetails,
          )
        : [];

    const selectedMovement =
      requestState.selectedMovement;

    const swiftDetails =
      selectedMovement
        ?.swiftDetails ?? null;

    try {
      const response = await fetch(
        webhookUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            requestId,

            documentType:
              requestState.documentType,

            customerId:
              requestState.customer
                .customerId,

            customerName:
              requestState.customer
                .name ?? null,

            customerDni:
              requestState.customer
                .dni ?? null,

            accountId:
              selectedAccountId,

            accountName:
              requestState
                .selectedAccount
                ?.accountName ??
              null,

            maskedAccountNumber:
              requestState
                .selectedAccount
                ?.maskedAccountNumber ??
              null,

            loanId:
              requestState
                .selectedLoan
                ?.loanId ?? null,

            loanName:
              requestState
                .selectedLoan
                ?.loanName ?? null,

            maskedLoanNumber:
              requestState
                .selectedLoan
                ?.maskedLoanNumber ??
              null,

            loanFinancialDetails,

            loanAmortizationSchedule,

            movementId:
              selectedMovement
                ?.movementId ?? null,

            movementDescription:
              selectedMovement
                ?.description ?? null,

            movementAmount:
              selectedMovement
                ?.amount ?? null,

            movementCurrency:
              selectedMovement
                ?.currency ?? null,

            movementDate:
              selectedMovement
                ?.date ?? null,

            /*
             * Datos SWIFT enriquecidos.
             *
             * Solo estarán presentes
             * cuando el movimiento
             * seleccionado corresponda
             * a una transferencia
             * internacional.
             */
            swiftDetails,

            dateRange:
              requestState.dateRange,

            accountMovements,
          }),
        },
      );

      if (!response.ok) {
        return {
          requestId,
          status: "failed",
          provider: "n8n",
          externalReference: null,
          output: {},
          error:
            `n8n returned HTTP ${response.status}.`,
        };
      }

      const data =
        (await response.json()) as
          N8nProcessingResponse;

      if (
        data.status !==
        "completed"
      ) {
        return {
          requestId,
          status: "failed",
          provider: "n8n",

          externalReference:
            data.externalReference ??
            null,

          output: {
            ...data,
          },

          error:
            `n8n returned unexpected status: ${data.status ?? "unknown"}.`,
        };
      }

      return {
        requestId,
        status: "completed",
        provider: "n8n",

        externalReference:
          data.externalReference ??
          null,

        output: {
          ...data,
        },

        error: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unexpected n8n processing error.";

      return {
        requestId,
        status: "failed",
        provider: "n8n",
        externalReference: null,
        output: {},
        error:
          errorMessage,
      };
    }
  }
}

export const documentProcessingService =
  new N8nDocumentProcessingService();