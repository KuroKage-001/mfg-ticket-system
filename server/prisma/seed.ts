import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const adminPassword = await bcrypt.hash("Admin@12345", 10);
  const employeePassword = await bcrypt.hash("Employee@12345", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@mfgsystem.com" },
    update: {},
    create: {
      fullName: "System Admin",
      email: "admin@mfgsystem.com",
      passwordHash: adminPassword,
      role: "ADMIN",
      isActive: true,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: "employee@mfgsystem.com" },
    update: {},
    create: {
      fullName: "Juan dela Cruz",
      email: "employee@mfgsystem.com",
      passwordHash: employeePassword,
      role: "EMPLOYEE",
      isActive: true,
    },
  });

  console.log("✅ Admin account created:");
  console.log(`   Email   : ${admin.email}`);
  console.log(`   Password: Admin@12345`);
  console.log(`   Role    : ${admin.role}`);

  console.log("\n✅ Employee account created:");
  console.log(`   Email   : ${employee.email}`);
  console.log(`   Password: Employee@12345`);
  console.log(`   Role    : ${employee.role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
