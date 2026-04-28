"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionList } from "@/components/billing/transaction-list";
import { useTranslations } from "next-intl";

export default function BillingPage() {
  const t = useTranslations("billing");

  const labels = {
    consume: t("consumeHistory"),
    recharge: t("rechargeHistory"),
  };

  return (
    <div className="py-6 md:py-10 px-4 md:px-8 max-w-[1400px] mx-auto">
      <Tabs defaultValue="consume" className="flex flex-col md:flex-row gap-8 w-full" orientation="vertical">
        <div className="w-full md:w-64 shrink-0">
          <TabsList className="flex flex-row md:flex-col h-auto w-full bg-slate-100/50 p-1 md:p-2 gap-1 items-stretch justify-start dark:bg-slate-900/50 rounded-xl overflow-x-auto">
            <TabsTrigger value="consume" className="justify-start md:px-4 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 rounded-lg whitespace-nowrap">
              {labels.consume}
            </TabsTrigger>
            <TabsTrigger value="recharge" className="justify-start md:px-4 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 rounded-lg whitespace-nowrap">
              {labels.recharge}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-w-0">
          <TabsContent value="consume" className="mt-0">
            <div className="max-w-4xl mx-auto md:mx-0 md:max-w-none">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">{labels.consume}</h2>
              <TransactionList type="consume" />
            </div>
          </TabsContent>
          <TabsContent value="recharge" className="mt-0">
            <div className="max-w-4xl mx-auto md:mx-0 md:max-w-none">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">{labels.recharge}</h2>
              <TransactionList type="recharge" />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
