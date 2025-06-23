import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

export function EmailProvider() {
  return {
    id: 'email',
    type: 'credentials' as const,
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      code: { label: 'Verification Code', type: 'text' },
      role: { label: 'Role', type: 'text' }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.code) {
        return null;
      }

      try {
        // 验证验证码
        const verificationToken = await prisma.verificationToken.findFirst({
          where: {
            identifier: credentials.email,
            token: credentials.code,
            expires: {
              gt: new Date()
            }
          }
        });

        if (!verificationToken) {
          return null;
        }

        // 查找或创建用户
        let user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: credentials.email,
              name: credentials.email.split('@')[0],
              emailVerified: new Date(),
              role: Role.LEARNER,
            }
          });
        } else if (!user.emailVerified) {
          // 更新用户验证状态
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              emailVerified: new Date(),
            }
          });
        }

        // 删除验证token
        await prisma.verificationToken.delete({
          where: {
            identifier_token: {
              identifier: credentials.email,
              token: credentials.code
            }
          }
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      } catch (error) {
        console.error('Email provider error:', error);
        return null;
      }
    }
  };
} 