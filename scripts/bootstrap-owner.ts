import { bootstrapOwner, OwnerAlreadyExistsError } from "@/lib/auth/owner";
import { prisma } from "@/lib/prisma";

async function main() {
  const password = process.env.PERSONALHUB_OWNER_PASSWORD;
  delete process.env.PERSONALHUB_OWNER_PASSWORD;
  if (!password)
    throw new Error(
      "PERSONALHUB_OWNER_PASSWORD is required and must be supplied only for this command."
    );
  try {
    await bootstrapOwner(password);
    console.log(
      "PersonalHub owner initialized. Remove the bootstrap variable."
    );
  } catch (error) {
    if (error instanceof OwnerAlreadyExistsError) {
      console.log("PersonalHub owner already exists; no changes were made.");
      return;
    }
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Owner bootstrap failed."
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
