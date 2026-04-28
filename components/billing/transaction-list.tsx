"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getTransactions } from "@/services/api";
import { useTranslations } from "next-intl";

interface Transaction {
  id: number;
  amount: number;
  type: string;
  remark: string | null;
  balance_after: number;
  created_at: string;
}

interface Props {
  type: "consume" | "recharge";
}

export function TransactionList({ type }: Props) {
  const t = useTranslations("transaction");
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading: loading } = useQuery({
    queryKey: ["transactions", type, page, limit],
    queryFn: () => getTransactions(type, page, limit),
  });

  const transactions: Transaction[] = data?.data?.items || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const typeLabel = (type: string) => {
    if (type === "consume") return t("typeConsume");
    if (type === "purchase") return t("typePurchase");
    if (type === "gift") return t("typeGift");
    return type;
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
          <thead className="bg-slate-50 text-xs uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="px-6 py-4">{t("date")}</th>
              <th className="px-6 py-4">{t("type")}</th>
              <th className="px-6 py-4">{t("amount")}</th>
              <th className="px-6 py-4">{t("balance")}</th>
              <th className="px-6 py-4">{t("remark")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">{t("loading")}</td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">{t("empty")}</td>
              </tr>
            ) : (
              transactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-200 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{typeLabel(t.type)}</td>
                  <td className={`px-6 py-4 whitespace-nowrap font-medium ${t.amount > 0 ? "text-green-500" : "text-red-500"}`}>
                    {t.amount > 0 ? `+${t.amount}` : t.amount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">{t.balance_after}</td>
                  <td className="px-6 py-4 max-w-[200px] truncate" title={t.remark || ""}>{t.remark || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t("page", { page, total: totalPages })}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}>
              {t("previous")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}>
              {t("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
