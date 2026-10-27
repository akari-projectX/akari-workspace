import { useTr } from "../lib/i18n";
import { allNav } from "../lib/nav";
import { navigate, type PageId } from "../lib/route";
import { Button, Card, EmptyState, PageHeader } from "../ui/primitives";

export function PlaceholderPage({ page }: { page: PageId }) {
  const tr = useTr();
  const n = allNav.find((x) => x.id === page);
  return (
    <>
      <PageHeader title={n ? tr(n.zh, n.en) : page} />
      <Card>
        <EmptyState
          icon={n?.icon ?? "file"}
          title={tr("此页不在 W33-a 设计范围内", "Not part of the W33-a design scope")}
          description={tr(
            "现有功能在 W33-b 中原样迁移到新的外壳、表格与抽屉组件，不改变行为。如需先出设计稿，请在设计评审中提出。",
            "W33-b moves the existing feature into the new shell, table and drawer components without changing behaviour. Ask in the design review if this page needs a design first.",
          )}
          action={
            <Button size="sm" onClick={() => navigate("dashboard")}>
              {tr("返回仪表盘", "Back to dashboard")}
            </Button>
          }
        />
      </Card>
    </>
  );
}
