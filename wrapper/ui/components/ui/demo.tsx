import { Loader, type LoaderVariant } from '@/components/ui/loader';
import { loaderVariants } from '@/loader-options.mjs';
export default function LoaderDemo() {
  return <div className="flex w-full items-center justify-center bg-background loader-demo text-foreground"><div className="grid grid-cols-3 loader-demo-grid sm:grid-cols-4 md:grid-cols-5">{loaderVariants.map(([variant,label])=><div key={variant} className="flex flex-col items-center loader-demo-item"><div className="flex h-14 items-center justify-center"><Loader variant={variant as LoaderVariant} size={40}/></div><span className="loader-demo-caption text-muted-foreground">{label}</span></div>)}</div></div>;
}
