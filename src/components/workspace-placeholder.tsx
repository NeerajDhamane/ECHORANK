import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles } from "lucide-react";
export function WorkspacePlaceholder({ title }: { title: string }) { return <div className="workspace-page"><div className="page-heading"><p className="eyebrow">BRAND WORKSPACE</p><h1>{title}</h1></div><EmptyState icon={<Sparkles size={21} />} title={`${title} is getting ready`} description="This workspace section will show evidence from your tracked prompts as the next build tasks add data and analysis." /></div>; }
