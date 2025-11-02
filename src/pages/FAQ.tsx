import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowUpRight, BookOpen, LifeBuoy, Search } from "lucide-react";

import PublicLayout from "@/components/PublicLayout";
import { PageIntro } from "@/components/marketing/PageIntro";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { BRAND_NAME } from "@/lib/brand";
import { apiClient } from "@/lib/api";
import { useContactConfig } from "@/hooks/useContactConfig";
import { FALLBACK_CONTACT_EMAIL, getEmailDetails } from "@/lib/contact";
import type {
  FAQCategoriesResponse,
  FAQCategoryWithItems,
  FAQUpdate,
  FAQUpdatesResponse,
} from "@/types/faq";

interface LocalFAQCategory {
  category: string;
  questions: Array<{ q: string; a: string }>;
}

function transformCategories(apiCategories: FAQCategoryWithItems[]): LocalFAQCategory[] {
  return apiCategories.map((category) => ({
    category: category.name,
    questions: category.items.map((item) => ({ q: item.question, a: item.answer })),
  }));
}

const quickLinks = [
  { label: "Open a support ticket", href: "/support", icon: LifeBuoy },
  { label: "View platform status", href: "/status", icon: ArrowUpRight },
  { label: "Browse API docs", href: "/api-docs", icon: BookOpen },
];

const toSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<LocalFAQCategory[]>([]);
  const [updates, setUpdates] = useState<FAQUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { contactConfig } = useContactConfig();
  const emailMethod = contactConfig.methods.email?.is_active ? contactConfig.methods.email : null;
  const emailDetails = getEmailDetails(emailMethod ?? undefined);
  const contactEmail = emailDetails.address || FALLBACK_CONTACT_EMAIL;

  useEffect(() => {
    const fetchFAQData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [categoriesResponse, updatesResponse] = await Promise.all([
          apiClient.get<FAQCategoriesResponse>("/faq/categories"),
          apiClient.get<FAQUpdatesResponse>("/faq/updates"),
        ]);
        setCategories(transformCategories(categoriesResponse.categories));
        setUpdates(updatesResponse.updates);
      } catch (err) {
        console.error("Failed to fetch FAQ data:", err);
        setError(err instanceof Error ? err.message : "Failed to load FAQ content");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchFAQData();
  }, []);

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return categories;
    }

    return categories
      .map((category) => ({
        ...category,
        questions: category.questions.filter((qa) =>
          qa.q.toLowerCase().includes(query) || qa.a.toLowerCase().includes(query),
        ),
      }))
      .filter((category) => category.questions.length > 0);
  }, [searchQuery, categories]);

  const totalQuestions = useMemo(
    () => categories.reduce((count, category) => count + category.questions.length, 0),
    [categories],
  );

  const answeredCount = filteredFaqs.reduce(
    (count, category) => count + category.questions.length,
    0,
  );

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Support"
          title="Frequently asked questions"
          description={`Find answers to the most common questions about ${BRAND_NAME}. Still need help? Our support team is a message away.`}
          align="center"
          actions={
            <>
              <Button asChild>
                <Link to="/support">Contact support</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/status">Check status</Link>
              </Button>
            </>
          }
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-8">
            <Card className="border border-border/80 bg-card/80 shadow-sm">
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by keyword or topic"
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
                <CardDescription className="mt-3 text-xs text-muted-foreground">
                  {isLoading
                    ? "Loading FAQ content..."
                    : `Showing ${answeredCount} of ${totalQuestions} answers`}
                </CardDescription>
              </CardContent>
            </Card>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((index) => (
                  <Card key={index} className="border border-border/80 bg-card/80 shadow-sm">
                    <CardContent className="space-y-4 p-6">
                      <Skeleton className="h-6 w-1/3" />
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error loading FAQ content</AlertTitle>
                <AlertDescription>
                  {error}. Please try refreshing the page or {" "}
                  <Link to="/support" className="font-medium underline">
                    contact support
                  </Link>{" "}
                  if the problem persists.
                </AlertDescription>
              </Alert>
            ) : categories.length === 0 ? (
              <Card className="border border-border/80 bg-card/80 shadow-sm">
                <CardContent className="py-10 text-center">
                  <CardTitle>No FAQ content available</CardTitle>
                  <CardDescription className="mt-2 text-sm">
                    We’re updating this section. In the meantime, {" "}
                    <Link to="/support" className="font-medium text-primary">
                      contact support
                    </Link>{" "}
                    for any questions.
                  </CardDescription>
                </CardContent>
              </Card>
            ) : filteredFaqs.length === 0 ? (
              <Card className="border border-border/80 bg-card/80 shadow-sm">
                <CardContent className="py-10 text-center">
                  <CardTitle>No results for “{searchQuery}”</CardTitle>
                  <CardDescription className="mt-2 text-sm">
                    Try adjusting your search or {" "}
                    <Link to="/support" className="font-medium text-primary">
                      contact support
                    </Link>{" "}
                    for personalized help.
                  </CardDescription>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {filteredFaqs.map((category) => (
                  <Card
                    key={category.category}
                    id={toSlug(category.category)}
                    className="border border-border/80 bg-card/80 shadow-sm"
                  >
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {category.category}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="space-y-2">
                        {category.questions.map((qa) => (
                          <AccordionItem key={qa.q} value={toSlug(qa.q)} className="border border-border/80">
                            <AccordionTrigger className="px-4 text-left text-sm font-medium">
                              {qa.q}
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
                              {qa.a}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <Card className="border border-border/80 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle>Latest updates</CardTitle>
                <CardDescription>Changes to the platform and documentation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : updates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent updates.</p>
                ) : (
                  <div className="space-y-4">
                    {updates.map((update) => (
                      <div key={update.id} className="rounded-lg border border-border/80 bg-muted/30 p-4 text-sm">
                        <p className="font-medium text-foreground">{update.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                          {new Date(update.published_at).toLocaleDateString()}
                        </p>
                        <p className="mt-2 text-muted-foreground">{update.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle>Need more help?</CardTitle>
                <CardDescription>
                  Reach out to our team and we’ll point you in the right direction.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button key={item.label} variant="outline" className="w-full justify-between" asChild>
                      <Link to={item.href}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" /> {item.label}
                        </span>
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  );
                })}
              </CardContent>
              <Separator />
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Prefer a human? Email us at {" "}
                  <a href={`mailto:${contactEmail}`} className="font-medium text-primary">
                    {contactEmail}
                  </a>
                  .
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </PublicLayout>
  );
}
