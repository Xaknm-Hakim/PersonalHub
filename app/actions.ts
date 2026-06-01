"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseOptionalDate } from "@/lib/utils";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return value ? String(value).trim() : "";
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

export async function createTask(formData: FormData) {
  await prisma.task.create({
    data: {
      title: text(formData, "title"),
      description: optionalText(formData, "description"),
      status: text(formData, "status"),
      priority: text(formData, "priority"),
      startDate: parseOptionalDate(formData.get("startDate")),
      dueDate: parseOptionalDate(formData.get("dueDate"))
    }
  });
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function updateTask(formData: FormData) {
  await prisma.task.update({
    where: { id: text(formData, "id") },
    data: {
      title: text(formData, "title"),
      description: optionalText(formData, "description"),
      status: text(formData, "status"),
      priority: text(formData, "priority"),
      startDate: parseOptionalDate(formData.get("startDate")),
      dueDate: parseOptionalDate(formData.get("dueDate"))
    }
  });
  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function deleteTask(formData: FormData) {
  await prisma.task.delete({ where: { id: text(formData, "id") } });
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function createAssignment(formData: FormData) {
  await prisma.assignment.create({
    data: {
      courseCode: text(formData, "courseCode"),
      courseName: text(formData, "courseName"),
      title: text(formData, "title"),
      description: optionalText(formData, "description"),
      type: text(formData, "type") || "assignment",
      status: text(formData, "status"),
      priority: text(formData, "priority"),
      startDate: parseOptionalDate(formData.get("startDate")),
      deadline: parseOptionalDate(formData.get("deadline")) ?? new Date()
    }
  });
  revalidatePath("/assignments");
  revalidatePath("/");
}

export async function updateAssignment(formData: FormData) {
  await prisma.assignment.update({
    where: { id: text(formData, "id") },
    data: {
      courseCode: text(formData, "courseCode"),
      courseName: text(formData, "courseName"),
      title: text(formData, "title"),
      description: optionalText(formData, "description"),
      type: text(formData, "type") || "assignment",
      status: text(formData, "status"),
      priority: text(formData, "priority"),
      startDate: parseOptionalDate(formData.get("startDate")),
      deadline: parseOptionalDate(formData.get("deadline")) ?? new Date()
    }
  });
  revalidatePath("/assignments");
  redirect("/assignments");
}

export async function deleteAssignment(formData: FormData) {
  await prisma.assignment.delete({ where: { id: text(formData, "id") } });
  revalidatePath("/assignments");
  revalidatePath("/");
}

export async function createProject(formData: FormData) {
  await prisma.project.create({
    data: {
      title: text(formData, "title"),
      description: optionalText(formData, "description"),
      status: text(formData, "status") || "planned",
      type: text(formData, "type") || "other",
      priority: text(formData, "priority") || "medium",
      startDate: parseOptionalDate(formData.get("startDate")),
      targetDate: parseOptionalDate(formData.get("targetDate")),
      completedAt: parseOptionalDate(formData.get("completedAt")),
      repositoryUrl: optionalText(formData, "repositoryUrl"),
      localPath: optionalText(formData, "localPath"),
      liveUrl: optionalText(formData, "liveUrl"),
      techStack: optionalText(formData, "techStack"),
      objective: optionalText(formData, "objective"),
      currentProgress: optionalText(formData, "currentProgress"),
      nextAction: optionalText(formData, "nextAction"),
      lessonsLearned: optionalText(formData, "lessonsLearned")
    }
  });
  revalidatePath("/projects");
  revalidatePath("/");
  revalidatePath("/timeline");
  revalidatePath("/calendar");
}

export async function updateProject(formData: FormData) {
  await prisma.project.update({
    where: { id: text(formData, "id") },
    data: {
      title: text(formData, "title"),
      description: optionalText(formData, "description"),
      status: text(formData, "status") || "planned",
      type: text(formData, "type") || "other",
      priority: text(formData, "priority") || "medium",
      startDate: parseOptionalDate(formData.get("startDate")),
      targetDate: parseOptionalDate(formData.get("targetDate")),
      completedAt: parseOptionalDate(formData.get("completedAt")),
      repositoryUrl: optionalText(formData, "repositoryUrl"),
      localPath: optionalText(formData, "localPath"),
      liveUrl: optionalText(formData, "liveUrl"),
      techStack: optionalText(formData, "techStack"),
      objective: optionalText(formData, "objective"),
      currentProgress: optionalText(formData, "currentProgress"),
      nextAction: optionalText(formData, "nextAction"),
      lessonsLearned: optionalText(formData, "lessonsLearned")
    }
  });
  revalidatePath("/projects");
  revalidatePath("/");
  revalidatePath("/timeline");
  revalidatePath("/calendar");
  redirect("/projects");
}

export async function deleteProject(formData: FormData) {
  await prisma.project.delete({ where: { id: text(formData, "id") } });
  revalidatePath("/projects");
  revalidatePath("/");
  revalidatePath("/timeline");
  revalidatePath("/calendar");
}

export async function createNote(formData: FormData) {
  const linkedTaskId = optionalText(formData, "linkedTaskId");
  const linkedAssignmentId = optionalText(formData, "linkedAssignmentId");
  await prisma.note.create({
    data: {
      title: text(formData, "title"),
      body: text(formData, "body"),
      linkedTaskId,
      linkedAssignmentId
    }
  });
  revalidatePath("/notes");
  revalidatePath("/");
}

export async function updateNote(formData: FormData) {
  await prisma.note.update({
    where: { id: text(formData, "id") },
    data: {
      title: text(formData, "title"),
      body: text(formData, "body"),
      linkedTaskId: optionalText(formData, "linkedTaskId"),
      linkedAssignmentId: optionalText(formData, "linkedAssignmentId")
    }
  });
  revalidatePath("/notes");
  redirect("/notes");
}

export async function deleteNote(formData: FormData) {
  await prisma.note.delete({ where: { id: text(formData, "id") } });
  revalidatePath("/notes");
  revalidatePath("/");
}
