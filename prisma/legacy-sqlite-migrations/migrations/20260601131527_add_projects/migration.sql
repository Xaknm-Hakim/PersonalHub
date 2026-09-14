-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "type" TEXT NOT NULL DEFAULT 'other',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "startDate" DATETIME,
    "targetDate" DATETIME,
    "completedAt" DATETIME,
    "repositoryUrl" TEXT,
    "localPath" TEXT,
    "liveUrl" TEXT,
    "techStack" TEXT,
    "objective" TEXT,
    "currentProgress" TEXT,
    "nextAction" TEXT,
    "lessonsLearned" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
