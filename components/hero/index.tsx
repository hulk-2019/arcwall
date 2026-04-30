"use client";

import { Button } from "@/components/ui/button";
import { useDesignStore } from "@/store/useDesignStore";
import { useAppStore } from "@/store/useAppStore";
import {
  Image as ImageIcon,
  Lightbulb,
  Sparkles,
  Plus,
  Layout,
  Loader2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  genWallpaper,
  optimizePrompt as apiOptimizePrompt,
  getSignedUrl,
  uploadImage,
  getDictionaries,
} from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations, useLocale } from "next-intl";

export default function Hero() {
  const {
    prompt,
    setPrompt,
    model: selectedModel,
    setModel: setSelectedModel,
    aspectRatio,
    setAspectRatio,
    imgUrl: uploadedImageUrl,
    setImgUrl: setUploadedImageUrl,
    imgPath: uploadedImagePath,
    setImgPath: setUploadedImagePath,
  } = useDesignStore();
  const { isSignedIn, isLoaded } = useUser();
  const { fetchUserInfo } = useAppStore();
  const router = useRouter();
  const t = useTranslations("prompt");
  const tHero = useTranslations("hero");
  const locale = useLocale();
  const isZh = locale === "zh";

  const [activeTab, setActiveTab] = useState("image");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signedPathsRef = useRef<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [currentPlaceholder, setCurrentPlaceholder] = useState("");

  const placeholders = tHero.raw("placeholders") as string[];

  useEffect(() => {
    let i = 0;
    const targetText = placeholders[placeholderIndex];
    const typingInterval = setInterval(() => {
      if (i < targetText.length) {
        setCurrentPlaceholder(targetText.slice(0, i + 1));
        i++;
      } else {
        clearInterval(typingInterval);
        setTimeout(() => setPlaceholderIndex((prev) => (prev + 1) % placeholders.length), 2000);
      }
    }, 50);
    return () => clearInterval(typingInterval);
  }, [placeholderIndex, locale]);

  const signedUrlMutation = useMutation({
    mutationFn: getSignedUrl,
    onSuccess: (data: any) => {
      if (data.code === 0 && data.data && uploadedImagePath) {
        const urls = uploadedImagePath.map((p: string) => data.data[p]).filter(Boolean);
        setUploadedImageUrls(urls);
        if (urls[0]) setUploadedImageUrl(urls[0]);
      }
    },
    onError: (e) => console.error("Sign url failed", e),
  });

  useEffect(() => {
    if (!uploadedImagePath || uploadedImagePath.length === 0) {
      setUploadedImageUrls([]);
      signedPathsRef.current = null;
      return;
    }
    const key = uploadedImagePath.join(",");
    if (signedPathsRef.current === key) return;
    signedPathsRef.current = key;
    signedUrlMutation.mutate({ paths: uploadedImagePath });
  }, [uploadedImagePath]);

  const { data: dictionariesData, isLoading: isDictionariesLoading } = useQuery({
    queryKey: ["dictionaries", ["model", "aspect_ratio"]],
    queryFn: () => getDictionaries(["model", "aspect_ratio"]),
  });

  const models =
    dictionariesData?.data
      ?.filter((item: any) => item.category === "model")
      .map((item: any) => ({
        id: item.key,
        name: isZh ? item.label_zh : item.label_en,
      })) || [];

  const aspectRatios =
    dictionariesData?.data
      ?.filter((item: any) => item.category === "aspect_ratio")
      .map((item: any) => item.key) || [];

  const generateMutation = useMutation({
    mutationFn: genWallpaper,
    onSuccess: (res: any) => {
      if (res.code === 0 && res.data) {
        fetchUserInfo(isSignedIn, isLoaded);
        router.push("/my-works");
        return;
      }
      toast.error(t("generationFailed"));
    },
    onError: (e: any) => {
      if (e.message?.includes("401")) { router.push("/sign-in"); return; }
      toast.error(t("generationFailed"));
    },
  });

  const handleGenerate = () => {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if (!prompt.trim()) return;
    generateMutation.mutate({
      description: prompt,
      model: selectedModel,
      language: locale,
      imgUrl: uploadedImageUrl || undefined,
      imgPath: uploadedImagePath || undefined,
      aspectRatio,
    });
  };

  const optimizeMutation = useMutation({
    mutationFn: apiOptimizePrompt,
    onSuccess: (res: any) => {
      if (res.code === 0 && res.data) {
        setPrompt(res.data);
        fetchUserInfo(isSignedIn, isLoaded);
        return;
      }
      toast.error(t("optimizePromptFailed"));
    },
    onError: () => {
      toast.error(t("optimizePromptFailed"));
    },
  });

  const handleOptimizePrompt = () => {
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if (!prompt.trim()) {
      toast.error(t("pleaseEnterPrompt"));
      return;
    }
    optimizeMutation.mutate({ prompt, language: locale });
  };

  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center overflow-hidden bg-background text-center">
      <div className="absolute inset-0 z-0">
        <img src="/banner.png" alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-60 dark:opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="absolute inset-0 bg-white/20 dark:bg-black/50" />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-8 flex flex-col items-center gap-10">
        <div className="space-y-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl drop-shadow-sm">
            {tHero("title")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-light">
            {tHero("subtitle")}
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <div className="flex -space-x-3">
              {["/user/1.jpeg", "/user/2.jpeg", "/user/3.jpeg", "/user/4.jpeg", "/user/5.jpeg", "/user/6.jpeg"].map((src, i) => (
                <img key={i} src={src} alt="User" className="w-8 h-8 rounded-full border-2 border-background" />
              ))}
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              {tHero("joinCreators")}
            </div>
          </div>
        </div>

        <div className="w-full max-w-4xl rounded-[24px] bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-2 shadow-2xl overflow-hidden ring-1 ring-gray-200 dark:ring-white/5 transition-colors duration-300">
          <div className="flex items-center gap-2 p-2 mb-2">
            <button
              onClick={() => setActiveTab("image")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === "image" ? "bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"}`}
            >
              <ImageIcon className="w-4 h-4" />
              Create Image
            </button>
          </div>

          <div className="relative bg-gray-50/50 dark:bg-white/5 rounded-[20px] p-4 md:p-6 min-h-[180px] flex flex-col justify-between border border-gray-100 dark:border-white/5 transition-colors hover:bg-gray-100/50 dark:hover:bg-white/10">
            <div className="flex flex-col md:flex-row items-start gap-3 md:gap-4 relative w-full">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  if (!files.length) return;

                  const currentCount = uploadedImagePath?.length || 0;
                  const remaining = 5 - currentCount;
                  if (remaining <= 0) {
                    toast.error(t("maxReferenceImages"));
                    return;
                  }

                  const filesToUpload = files.slice(0, remaining);
                  const oversized = filesToUpload.filter(f => f.size > 50 * 1024 * 1024);
                  if (oversized.length > 0) {
                    toast.error(t("imageTooLarge"));
                    return;
                  }

                  setIsUploading(true);
                  try {
                    const results = await Promise.all(
                      filesToUpload.map(file => {
                        const formData = new FormData();
                        formData.append("file", file);
                        return uploadImage(formData);
                      })
                    );
                    const newUrls: string[] = [];
                    const newPaths: string[] = [];
                    results.forEach((res: any) => {
                      if (res.code === 0) {
                        newUrls.push(res.data.url);
                        newPaths.push(res.data.name);
                      }
                    });
                    const mergedPaths = [...(uploadedImagePath || []), ...newPaths];
                    setUploadedImageUrls(prev => [...prev, ...newUrls]);
                    setUploadedImagePath(mergedPaths);
                    setUploadedImageUrl(newUrls[0] || uploadedImageUrl || null);
                    signedPathsRef.current = mergedPaths.join(",");
                  } catch (err) {
                    console.error("Upload error", err);
                    toast.error(t("uploadFailed"));
                  } finally {
                    setIsUploading(false);
                  }
                }}
              />

              {/* Reference image thumbnails */}
              <div className="order-2 md:order-1 w-full md:w-auto">
                {(() => {
                  const items = [...uploadedImageUrls];
                  if (items.length < 5) items.push("ADD_BUTTON");
                  const stackRotations = [0, -10, 12, -8, 10, -12];
                  const stackX = [0, -8, 8, -6, 6, -8];
                  const stackY = [0, 2, 4, 6, 8, 10];
                  const fanRotations = [-4, 3, -2, 4, -3, 2];

                  return uploadedImageUrls.length === 0 ? (
                    <div 
                      className="relative shrink-0 w-[72px] h-[96px] z-20 cursor-pointer"
                      onClick={() => { if (!isSignedIn) { router.push("/sign-in"); return; } fileInputRef.current?.click(); }}
                    >
                      <div className="w-full h-full bg-gray-100 dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/10 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                        {isUploading ? (
                          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{t("referenceImage")}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Mobile view: horizontal scroll list */}
                      <div className="flex md:hidden flex-row gap-3 overflow-x-auto pb-2 w-full snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {items.map((item, index) => {
                          const isAddBtn = item === "ADD_BUTTON";
                          return (
                            <div
                              key={`mobile-${index}`}
                              className="shrink-0 w-[72px] h-[96px] snap-start relative cursor-pointer"
                              onClick={() => {
                                if (isAddBtn) {
                                  if (!isSignedIn) { router.push("/sign-in"); return; } 
                                  fileInputRef.current?.click();
                                }
                              }}
                            >
                              {isAddBtn ? (
                                <div className="w-full h-full bg-gray-100 dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/10 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                                  {isUploading ? (
                                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                                  ) : (
                                    <>
                                      <Plus className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{t("referenceImage")}</span>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="w-full h-full relative border-[2px] border-white/20 dark:border-gray-600/50 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800">
                                  <img src={item} alt="" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      const newUrls = uploadedImageUrls.filter((_, i) => i !== index);
                                      const newPaths = (uploadedImagePath || []).filter((_, i) => i !== index);
                                      setUploadedImageUrls(newUrls);
                                      setUploadedImagePath(newPaths.length > 0 ? newPaths : null);
                                      setUploadedImageUrl(newUrls[0] || null);
                                      signedPathsRef.current = newPaths.length > 0 ? newPaths.join(",") : null;
                                    }}
                                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center transition-opacity"
                                  >
                                    <X className="w-3 h-3 text-white" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop view: stacked cards */}
                      <div className="hidden md:block relative shrink-0 w-[82px] h-[96px] group z-20">
                        <div className="absolute left-0 top-0 h-[96px] hidden group-hover:block" style={{ width: `${items.length * 82}px` }} />
                        {items.map((item, index) => {
                          const isAddBtn = item === "ADD_BUTTON";
                          const zIndex = 50 - index;
                          return (
                            <div
                              key={`desktop-${index}`}
                              className={`absolute left-0 top-0 w-[72px] h-[96px] rounded-xl shadow-md transition-all duration-300 origin-bottom-left cursor-pointer
                                [transform:translate(var(--stack-x),var(--stack-y))_rotate(var(--stack-rot))]
                                group-hover:[transform:translate(var(--fan-x),var(--fan-y))_rotate(var(--fan-rot))]
                                ${isAddBtn ? "opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto" : "opacity-100 pointer-events-auto"}
                              `}
                              style={{
                                '--stack-x': `${stackX[index]}px`,
                                '--stack-y': `${stackY[index]}px`,
                                '--stack-rot': `${stackRotations[index]}deg`,
                                '--fan-x': `${index * 82}px`,
                                '--fan-y': `0px`,
                                '--fan-rot': `${fanRotations[index]}deg`,
                                zIndex,
                              } as React.CSSProperties}
                              onClick={() => {
                                if (isAddBtn) {
                                  if (!isSignedIn) { router.push("/sign-in"); return; } 
                                  fileInputRef.current?.click();
                                }
                              }}
                            >
                              {isAddBtn ? (
                                <div className="w-full h-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-[#333] transition-colors overflow-hidden">
                                  {isUploading ? (
                                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                                  ) : (
                                    <>
                                      <Plus className="w-6 h-6 text-gray-300" />
                                      <span className="text-[10px] text-gray-300">{t("referenceImage")}</span>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="w-full h-full relative group/card border-[2px] border-white/20 dark:border-gray-600/50 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800">
                                  <img src={item} alt="" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      const newUrls = uploadedImageUrls.filter((_, i) => i !== index);
                                      const newPaths = (uploadedImagePath || []).filter((_, i) => i !== index);
                                      setUploadedImageUrls(newUrls);
                                      setUploadedImagePath(newPaths.length > 0 ? newPaths : null);
                                      setUploadedImageUrl(newUrls[0] || null);
                                      signedPathsRef.current = newPaths.length > 0 ? newPaths.join(",") : null;
                                    }}
                                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3 text-white" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* The circular Add button when stacked */}
                        {uploadedImageUrls.length < 5 && (
                          <div 
                            className="absolute -bottom-2 -right-3 z-[60] w-10 h-10 bg-[#2a2a2a] border-[2px] border-[#3a3a3a] rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 opacity-100 group-hover:opacity-0 group-hover:scale-50 shadow-xl"
                            onClick={(e) => { 
                              e.stopPropagation();
                              if (!isSignedIn) { router.push("/sign-in"); return; } 
                              fileInputRef.current?.click(); 
                            }}
                          >
                            {isUploading ? (
                              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                            ) : (
                              <>
                                <Plus className="w-4 h-4 text-gray-300 mb-[-2px]" />
                                <span className="text-[7px] text-gray-400 scale-90">{t("referenceImage")}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              <textarea
                placeholder={currentPlaceholder}
                className="order-1 md:order-2 w-full md:flex-1 h-24 md:h-28 bg-transparent border-0 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none focus:ring-0 text-base md:text-lg leading-relaxed outline-none py-2"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGenerate(); } }}
              />
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-2 flex-wrap">
                {isDictionariesLoading ? (
                  <Skeleton className="h-8 w-32 rounded-xl bg-gray-200 dark:bg-white/20" />
                ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white/10 text-white border border-transparent dark:border-white/10 text-xs font-medium hover:bg-gray-800 dark:hover:bg-white/20 transition-colors shadow-sm outline-none">
                      <Sparkles className="w-3.5 h-3.5" />
                      {models.find((m: any) => m.id === selectedModel)?.name || selectedModel}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[200px]">
                    {models.map((model: any) => (
                      <DropdownMenuItem key={model.id} onClick={() => setSelectedModel(model.id)} className="cursor-pointer">
                        {model.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                )}

                {isDictionariesLoading ? (
                  <Skeleton className="h-8 w-24 rounded-xl bg-gray-200 dark:bg-white/20" />
                ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white/10 text-white border border-transparent dark:border-white/10 text-xs font-medium hover:bg-gray-800 dark:hover:bg-white/20 transition-colors shadow-sm outline-none">
                      <Layout className="w-3.5 h-3.5" />
                      {aspectRatio}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[100px]">
                    {aspectRatios.map((ratio: string) => (
                      <DropdownMenuItem key={ratio} onClick={() => setAspectRatio(ratio)} className="cursor-pointer">
                        {ratio}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                )}

                <button
                  onClick={handleOptimizePrompt}
                  disabled={optimizeMutation.isPending || generateMutation.isPending}
                  className="flex whitespace-nowrap items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white/10 text-white border border-transparent dark:border-white/10 text-xs font-medium hover:bg-gray-800 dark:hover:bg-white/20 transition-colors shadow-sm outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t("optimizeTitle")}
                >
                  {optimizeMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
                  ) : (
                    <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                  )}
                  {t("optimize")}
                </button>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="w-full md:w-auto rounded-full px-8 h-12 text-base font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:opacity-90 border-0 shadow-lg text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generateMutation.isPending ? t("loading") : t("button")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
