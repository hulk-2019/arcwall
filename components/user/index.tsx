"use client";

import * as React from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@/types/user";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { generateRedeemCode, useRedeemCode } from "@/services/api";
import { useTranslations } from "next-intl";

interface Props {
  user: User;
}

export default function ({ user }: Props) {
  const t = useTranslations("user");
  const { fetchUserInfo } = useAppStore();
  const { isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();

  const [showGenerateDialog, setShowGenerateDialog] = React.useState(false);
  const [showRedeemDialog, setShowRedeemDialog] = React.useState(false);
  const [generatedCode, setGeneratedCode] = React.useState<string | null>(null);
  const [redeemCode, setRedeemCode] = React.useState("");

  const isSuperAdmin = user.roles?.includes("superadmin") ?? false;

  const generateMutation = useMutation({
    mutationFn: generateRedeemCode,
    onSuccess: (res: any) => {
      if (res.code === 0 && res.data?.code) {
        setGeneratedCode(res.data.code);
      } else {
        toast.error(t("generateRedeemCodeFailed"));
      }
    },
    onError: () => {
      toast.error(t("generateRedeemCodeFailed"));
    },
  });

  const handleCopyCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      toast.success(t("generateDialog.copied"));
    } catch {
      toast.error(t("generateDialog.copyFailed"));
    }
  };

  const redeemMutation = useMutation({
    mutationFn: useRedeemCode,
    onSuccess: (res: any) => {
      if (res.code === 0) {
        setShowRedeemDialog(false);
        setRedeemCode("");
        fetchUserInfo(isSignedIn, isLoaded);
        return;
      }
      toast.error(t("redeemCodeFailed"));
    },
    onError: () => {
      toast.error(t("redeemCodeFailed"));
    },
  });

  const handleRedeem = () => {
    if (!redeemCode.trim()) {
      toast.error(t("redeemDialog.emptyError"));
      return;
    }
    redeemMutation.mutate(redeemCode);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Avatar className="h-9 w-9 cursor-pointer">
            <AvatarImage src={user.avatar_url} alt={user.nickname} />
            <AvatarFallback>{user.nickname}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="mx-4 w-56">
          <DropdownMenuLabel className="text-center truncate flex flex-col items-center gap-1">
            <span className="font-medium">{user.nickname}</span>
            <span className="text-xs text-muted-foreground font-normal">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {user.credits && (
            <>
              <DropdownMenuItem className="md:hidden text-center cursor-default justify-center font-medium">
                {user.credits.left_credits} Credits
              </DropdownMenuItem>
              <DropdownMenuSeparator className="md:hidden" />
            </>
          )}

          <DropdownMenuItem asChild>
            <Link href="/my-works" className="w-full cursor-pointer">{t("myWorkspace")}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/trash" className="w-full cursor-pointer">{t("trash")}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/billing" className="w-full cursor-pointer">{t("billing")}</Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {isSuperAdmin && (
            <DropdownMenuItem
              onClick={() => { setGeneratedCode(null); setShowGenerateDialog(true); }}
              className="cursor-pointer"
            >
              {t("generateRedeemCode")}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => { setRedeemCode(""); setShowRedeemDialog(true); }}
            className="cursor-pointer"
          >
            {t("redeemCode")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem className="cursor-pointer" onClick={() => signOut({ redirectUrl: "/" })}>
            {t("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Generate Redeem Code Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("generateDialog.title")}</DialogTitle>
          </DialogHeader>

          {!generatedCode && (
            <p className="text-sm text-muted-foreground mb-4">{t("generateDialog.description")}</p>
          )}

          {generatedCode && (
            <div className="space-y-2 mb-4">
              <p className="text-sm text-muted-foreground">{t("generateDialog.generated")}</p>
              <div className="flex gap-2">
                <Input value={generatedCode} readOnly className="font-mono" />
                <Button type="button" onClick={handleCopyCode}>{t("generateDialog.copy")}</Button>
              </div>
            </div>
          )}

          <DialogFooter>
            {!generatedCode ? (
              <>
                <Button variant="outline" type="button" onClick={() => setShowGenerateDialog(false)}>
                  {t("generateDialog.cancel")}
                </Button>
                <Button type="button" onClick={() => { setGeneratedCode(null); generateMutation.mutate(); }} disabled={generateMutation.isPending}>
                  {generateMutation.isPending ? t("generateDialog.generating") : t("generateDialog.confirm")}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => setShowGenerateDialog(false)}>
                {t("generateDialog.done")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redeem Code Dialog */}
      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("redeemDialog.title")}</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground mb-4">{t("redeemDialog.description")}</p>

          <Input
            placeholder={t("redeemDialog.placeholder")}
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
          />

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowRedeemDialog(false)}>
              {t("redeemDialog.cancel")}
            </Button>
            <Button type="button" onClick={handleRedeem} disabled={redeemMutation.isPending}>
              {redeemMutation.isPending ? t("redeemDialog.redeeming") : t("redeemDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
