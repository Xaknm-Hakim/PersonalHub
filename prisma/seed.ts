import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysFromNow(days: number, hour = 9) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

async function main() {
  await prisma.note.deleteMany();
  await prisma.task.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.tag.deleteMany();

  const tags = await Promise.all(
    [
      ["Diploma", "#2563eb"],
      ["Programming", "#16a34a"],
      ["Math", "#7c3aed"],
      ["Urgent", "#dc2626"],
      ["Revision", "#ea580c"]
    ].map(([name, color]) =>
      prisma.tag.create({
        data: { name, color }
      })
    )
  );

  const [diploma, programming, math, urgent, revision] = tags;

  const webTask = await prisma.task.create({
    data: {
      title: "Review responsive layout notes",
      description: "Check lecturer feedback before the web design lab.",
      status: "doing",
      priority: "high",
      startDate: daysFromNow(-1),
      dueDate: daysFromNow(0, 18),
      tags: { connect: [{ id: programming.id }, { id: revision.id }] }
    }
  });

  await prisma.task.createMany({
    data: [
      {
        title: "Print database normalization worksheet",
        description: "Bring a hard copy for the tutorial session.",
        status: "todo",
        priority: "medium",
        startDate: daysFromNow(1),
        dueDate: daysFromNow(2, 12)
      },
      {
        title: "Update weekly study planner",
        description: "Block focused time for assignments and revision.",
        status: "todo",
        priority: "low",
        dueDate: daysFromNow(4, 20)
      },
      {
        title: "Submit club event reflection",
        description: "Short reflection was due last week.",
        status: "todo",
        priority: "urgent",
        startDate: daysFromNow(-8),
        dueDate: daysFromNow(-2, 17)
      },
      {
        title: "Complete JavaScript quiz practice",
        description: "Finished mock quiz questions.",
        status: "done",
        priority: "medium",
        startDate: daysFromNow(-4),
        dueDate: daysFromNow(-1, 22)
      }
    ]
  });

  const assignment = await prisma.assignment.create({
    data: {
      courseCode: "DIT204",
      courseName: "Web Application Development",
      title: "Personal Portfolio Website",
      description: "Build a responsive portfolio with project cards and contact form.",
      type: "project",
      status: "in_progress",
      priority: "urgent",
      startDate: daysFromNow(-5),
      deadline: daysFromNow(3, 23),
      tags: { connect: [{ id: diploma.id }, { id: programming.id }, { id: urgent.id }] }
    }
  });

  await prisma.assignment.createMany({
    data: [
      {
        courseCode: "DBS201",
        courseName: "Database Systems",
        title: "ERD and Normalization Report",
        description: "Prepare ERD, relational schema, and 3NF explanation.",
        type: "assignment",
        status: "not_started",
        priority: "high",
        startDate: daysFromNow(0),
        deadline: daysFromNow(6, 23)
      },
      {
        courseCode: "STA110",
        courseName: "Statistics for Computing",
        title: "Probability Problem Set",
        description: "Complete questions 1 to 12 with workings.",
        type: "exercise",
        status: "submitted",
        priority: "medium",
        startDate: daysFromNow(-7),
        deadline: daysFromNow(-1, 23)
      }
    ]
  });

  await prisma.note.createMany({
    data: [
      {
        title: "Web app rubric reminders",
        body: "Rubric focuses on accessibility, semantic HTML, and consistent spacing.",
        linkedTaskId: webTask.id,
        linkedAssignmentId: assignment.id
      },
      {
        title: "Database lecture summary",
        body: "Partial dependency only matters when a table has a composite primary key."
      },
      {
        title: "Questions for statistics tutorial",
        body: "Ask about binomial distribution continuity correction examples."
      }
    ]
  });

  const dbNote = await prisma.note.findFirst({ where: { title: "Database lecture summary" } });
  if (dbNote) {
    await prisma.note.update({
      where: { id: dbNote.id },
      data: { tags: { connect: [{ id: math.id }, { id: revision.id }] } }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
