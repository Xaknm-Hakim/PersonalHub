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
  await prisma.project.deleteMany();
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

  const projects = [
    {
        title: "StudexHub v1",
        status: "archived",
        type: "software",
        priority: "medium",
        techStack: "Next.js, TypeScript, Prisma, PostgreSQL, Docker, Nginx, Cloudflare Tunnel",
        description: "Academic/student platform prototype and infrastructure learning project.",
        startDate: daysFromNow(-180),
        completedAt: daysFromNow(-90),
        currentProgress: "Archived after validating the prototype and deployment path.",
        lessonsLearned: "Learned production-style reverse proxying, container deployment, and tunnel-based access."
    },
    {
        title: "PersonalHub",
        status: "developing",
        type: "software",
        priority: "high",
        techStack: "Next.js, TypeScript, Prisma, SQLite, Docker Compose, Tailwind",
        description: "Private local-first personal operations system.",
        startDate: daysFromNow(-14),
        targetDate: daysFromNow(30),
        objective: "Build a private control panel for tasks, assignments, notes, calendar, timeline, and project memory.",
        currentProgress: "Core local productivity modules are running.",
        nextAction: "Keep shaping modules around real daily use."
    },
    {
        title: "Packet Tracer Campus Network Lab",
        status: "completed",
        type: "networking",
        priority: "medium",
        techStack: "Cisco Packet Tracer, VLAN, OSPF, Inter-VLAN Routing, NAT",
        description: "Campus-style networking topology lab.",
        startDate: daysFromNow(-45),
        completedAt: daysFromNow(-25),
        currentProgress: "Completed topology and routing validation.",
        lessonsLearned: "Practiced segmentation, dynamic routing, and edge NAT behavior."
    },
    {
        title: "Terraform AWS EC2 Lab",
        status: "planned",
        type: "cloud",
        priority: "high",
        techStack: "Terraform, AWS EC2, VPC, Security Groups",
        description: "Planned cloud infrastructure automation lab.",
        targetDate: daysFromNow(45),
        objective: "Provision a minimal EC2 environment with repeatable infrastructure code.",
        nextAction: "Draft the Terraform module structure and variable inputs."
    },
    {
        title: "Docker Monitoring Stack",
        status: "planned",
        type: "infrastructure",
        priority: "medium",
        techStack: "Docker Compose, Prometheus, Grafana, cAdvisor",
        description: "Planned local monitoring stack for personal services.",
        targetDate: daysFromNow(60),
        objective: "Monitor local containers without adding cloud dependencies.",
        nextAction: "Define compose services and persistent volumes."
    }
  ];

  await prisma.project.createMany({ data: projects });

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
