import {
  createTagAction,
  deleteTagAction,
  updateTagAction
} from "@/app/tags/actions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { findTags } from "@/features/tags/service";
import { DeleteControl } from "@/components/delete-control";
import { MutationForm } from "@/components/mutation-form";
export const dynamic = "force-dynamic";
export default async function TagsPage() {
  const tags = await findTags();
  return (
    <>
      <PageHeader
        title="Tags"
        description="Group related work across tasks, assignments, and notes."
      />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent className="p-4">
            <MutationForm action={createTagAction} className="space-y-3">
              <Input
                name="name"
                aria-label="Tag name"
                required
                placeholder="Tag name"
              />
              <Input
                name="color"
                aria-label="Tag color"
                placeholder="Optional color, e.g. #0f766e"
              />
              <Button type="submit">Add tag</Button>
            </MutationForm>
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2">
          {tags.map((tag) => (
            <Card key={tag.id}>
              <CardContent className="p-4">
                <MutationForm
                  action={updateTagAction}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="id" value={tag.id} />
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color || "#64748b" }}
                  />
                  <Input
                    name="name"
                    aria-label="Tag name"
                    defaultValue={tag.name}
                  />
                  <Input
                    name="color"
                    aria-label="Tag color"
                    defaultValue={tag.color ?? ""}
                  />
                  <Button size="sm" variant="secondary">
                    Save
                  </Button>
                </MutationForm>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tag._count.tasks + tag._count.assignments + tag._count.notes}{" "}
                  linked items
                </p>
                <div className="mt-2">
                  <DeleteControl action={deleteTagAction} id={tag.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
