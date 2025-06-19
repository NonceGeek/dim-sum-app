import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function ApiPage() {
  return (
    <>
      <Header />
      <div className="min-h-[calc(100vh-56px)] bg-[var(--color-accent-background)]">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <Card className="p-6 bg-card transition-all duration-200 hover:shadow-lg">
              <h2 className="text-2xl font-semibold mb-6">Learn More</h2>

              <div className="border-b border-border pb-6 mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-medium mb-2">Document</h3>
                    <p className="text-muted-foreground">
                      Discover how Dimsum AI helps you leverage your business
                    </p>
                  </div>
                  <Link href="/docs">
                    <Button
                      variant="common"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      View More
                    </Button>
                  </Link>
                </div>
              </div>

              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-medium mb-2">Get API Key</h3>
                    <p className="text-muted-foreground">
                      Tap to fill your application
                    </p>
                  </div>
                  <Link href="/workplace/api/apply">
                    <Button
                      variant="common"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      Apply
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
