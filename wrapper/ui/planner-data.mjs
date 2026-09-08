// Read-only projection. User workflows define completion, never fixed phase names.
export function dueCases(entities, workflows, today) {
  return entities
    .filter((entity) => {
      const process = entity.fields.process?.[0]?.value;
      if (!process?.due_date || process.due_date > today || !process.next_step)
        return false;
      const workflow = workflows.find((item) => item.id === process.workflow);
      const stage = workflow?.stages.find((item) => item.id === process.stage);
      return stage?.terminal === false;
    })
    .sort((a, b) =>
      a.fields.process[0].value.due_date.localeCompare(
        b.fields.process[0].value.due_date,
      ),
    );
}
