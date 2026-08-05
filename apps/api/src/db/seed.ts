import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

// Creates one demo account so a fresh clone can log in immediately without
// going through the registration form. Run with `npm run seed`.
async function main() {
  const email = "demo@commentiq.dev";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already exists:", email);
    return;
  }

  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: "Demo User", plan: "free" },
  });
  console.log("Created demo user:", user.email, "(password: password123)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
