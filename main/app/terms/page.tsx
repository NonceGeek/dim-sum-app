'use client';

import { Header } from '@/components/layout/header';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsPage() {
  const router = useRouter();

  return (
    <>
      <Header />
      <div className="min-h-[calc(100vh-56px)] bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <button 
                onClick={() => router.back()}
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </button>
            </div>
            <div className="bg-card rounded-lg shadow-sm border p-8">
              <h1 className="text-3xl font-bold text-foreground mb-8 text-center">Dim Sum AI Lab网站用户协议</h1>

              <div className="prose prose-gray dark:prose-invert max-w-none">
                <div className="mb-8 text-muted-foreground">
                  <p>1.1 欢迎您使用 Dim Sum AI Lab（以下简称&quot;本实验室&quot;、&quot;我们&quot;）的网站（https://www.aidimsum.com/）及相关服务。</p>
                  <p className="mt-4">1.2 本用户协议（以下简称&quot;本协议&quot;）是您与 Dim Sum AI Lab 之间就使用我们的网站和服务所订立的协议。本协议对您和本实验室均具有法律约束力。</p>
                  <p className="mt-4">1.3 请您在使用我们的服务之前，仔细阅读并充分理解本协议的所有内容，特别是以粗体标注的条款。如果您不同意本协议的任何内容，请勿使用我们的服务。您使用我们的服务，即表示您同意接受本协议的所有条款。</p>
                </div>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold mb-4 text-primary">一、总则</h2>
                  <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                    <p>1.1 欢迎您使用 Dim Sum AI Lab（以下简称&quot;本实验室&quot;、&quot;我们&quot;）的网站（https://www.aidimsum.com/）及相关服务。</p>
                    <p>1.2 本用户协议（以下简称&quot;本协议&quot;）是您与 Dim Sum AI Lab 之间就使用我们的网站和服务所订立的协议。本协议对您和本实验室均具有法律约束力。</p>
                    <p>1.3 请您在使用我们的服务之前，仔细阅读并充分理解本协议的所有内容，特别是以粗体标注的条款。如果您不同意本协议的任何内容，请勿使用我们的服务。您使用我们的服务，即表示您同意接受本协议的所有条款。</p>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold mb-4 text-primary">二、服务内容</h2>
                  <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                    <p>2.1 本实验室致力于建设AI友好型粤语语料库，链接全球粤语AI生态。我们的服务包括但不限于：</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>粤语语料库的访问与使用</li>
                      <li>基于粤语语料的人工智能应用</li>
                      <li>粤语搜索引擎服务</li>
                      <li>AI SaaS 框架使用</li>
                      <li>学术研究资源分享</li>
                      <li>开源社区参与</li>
                    </ul>
                    <p>2.2 我们保留随时修改、暂停或终止部分或全部服务的权利。对于免费服务，我们可能不经事先通知即进行修改或终止。</p>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold mb-4 text-primary">三、用户注册与账户管理</h2>
                  <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                    <p>3.1 您可能需要注册账户以使用我们的某些服务。在注册过程中，您应：</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>提供真实、准确、完整和最新的个人信息</li>
                      <li>妥善保管您的账户信息和密码</li>
                      <li>及时更新您的账户信息以保持其准确性</li>
                    </ul>
                    <p>3.2 您应对通过您的账户进行的所有活动承担责任。如发现任何未经授权使用您账户的情况，应立即通知我们。</p>
                    <p>3.3 根据中国法律法规要求，您可能需要进行实名认证才能使用特定服务。</p>
                    <p>3.4 我们保留在以下情况下终止或暂停您的账户的权利：</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>您违反本协议或相关服务条款</li>
                      <li>您提供的信息不真实、不准确或不完整</li>
                      <li>您的行为可能损害我们、其他用户或第三方的利益</li>
                      <li>法律法规要求或政府部门的命令</li>
                    </ul>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold mb-4 text-primary">四、用户行为规范</h2>
                  <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                    <p>4.1 您同意遵守所有适用的法律法规，不得利用我们的服务从事任何违法或不当活动，包括但不限于：</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>侵犯他人的知识产权、隐私权或其他合法权益</li>
                      <li>发布、传播违法、有害、淫秽、色情、赌博、暴力、恐怖主义等违禁内容</li>
                      <li>干扰或破坏我们服务及相关网络和系统的正常运行</li>
                      <li>冒充他人或组织，或以虚假方式陈述您与任何人或组织的关系</li>
                    </ul>
                    <p>4.2 语料贡献规范： 如果您向我们的粤语语料库贡献内容，您应确保：</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>您拥有或已获授权使用您贡献内容的相关权利</li>
                      <li>内容真实、准确，符合标注规范</li>
                      <li>内容不含有侵权、违法或不当信息</li>
                      <li>提供必要的声明和标注，注明数据来源（如适用）</li>
                    </ul>
                    <p>4.3 社区互动规范：在与其他用户互动时，您应：</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>尊重他人，不发表攻击性、歧视性或挑衅性言论</li>
                      <li>提供建设性反馈，促进学术讨论和交流</li>
                      <li>遵守特定社区或讨论区的额外规则（如有）</li>
                    </ul>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold mb-4 text-primary">五、知识产权</h2>
                  <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                    <p>5.1 本实验室网站及服务中的所有内容、设计、图像、标识、代码等（除用户贡献内容外）均为我们或我们的许可方所有，受知识产权法保护。未经我们明确书面许可，您不得复制、修改、分发、销售或利用这些内容。</p>
                    <p>5.2 对于您向粤语语料库或开源项目贡献的内容：</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>您保留对贡献内容的所有权利</li>
                      <li>您授予我们全球性、非独占、免费、可转让、可再许可的权利，允许我们使用、复制、修改、分发、展示、翻译您的内容，以提供和改进我们的服务</li>
                      <li>您同意您的贡献可能被用于粤语AI模型的训练和优化</li>
                      <li>您确认您有权授予上述许可，且您的内容不侵犯任何第三方权利</li>
                    </ul>
                    <p>5.3 我们的部分内容和项目采用开源许可证提供。使用这些开源内容时，您必须遵守相应开源许可证的条款。</p>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold mb-4 text-primary">六、隐私保护</h2>
                  <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                    <p>6.1 我们重视您的隐私。我们按照《Dim Sum AI Lab隐私政策》收集、使用、存储和保护您的个人信息。使用我们的服务，即表示您同意我们按照隐私政策处理您的个人信息。</p>
                    <p>6.2 特别提醒：对于您贡献的粤语语料数据（尤其是语音、视频等可能涉及个人信息的内容），我们将严格按照隐私政策和您同意的范围进行处理和使用。</p>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold mb-4 text-primary">七、免责声明</h2>
                  <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                    <p>7.1 我们的服务按&quot;现状&quot;和&quot;可用性&quot;提供，不提供任何明示或暗示的保证。</p>
                    <p>7.2 我们不对服务的及时性、安全性、准确性做出保证，也不保证服务不会中断或出现错误。</p>
                    <p>7.3 对于用户自行上传、发布的内容，我们不承担任何责任。</p>
                    <p>7.4 在法律允许的最大范围内，我们不对任何直接的、间接的、偶然的、特殊的、后果性的或惩罚性的损害承担责任。</p>
                    <p>7.5 您理解AI技术固有局限性，AI生成内容可能不准确、不完整、存在偏见或侵权风险，您需自行判断和负责任地使用。</p>
                    <p>7.6 您理解本实验室许多工作具有研究和实验性质，相关信息、工具、数据可能存在错误、不完善或随时变更，不保证任何研究成果或目标的实现。</p>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold mb-4 text-primary">八、协议修改</h2>
                  <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                    <p>8.1 我们保留随时修改本协议的权利。修改后的协议将在网站上公布。</p>
                    <p>8.2 对于重大变更，我们会通过网站公告、电子邮件或其他方式通知您。</p>
                    <p>8.3 如您在协议变更后继续使用我们的服务，即表示您接受修改后的协议。</p>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold mb-4 text-primary">九、法律适用与争议解决</h2>
                  <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                    <p>9.1 本协议受中华人民共和国法律管辖并按其解释。</p>
                    <p>9.2 与本协议相关的任何争议应首先通过友好协商解决。</p>
                    <p>9.3 协商不成的，任何一方均可向本实验室所在地有管辖权的人民法院提起诉讼。</p>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold mb-4 text-primary">十、其他条款</h2>
                  <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                    <p>10.1 本协议构成您与我们之间关于服务使用的完整协议，取代先前或同时期的所有协议、提议和陈述。</p>
                    <p>10.2 本协议中的标题仅为方便阅读而设，不影响协议条款的含义或解释。</p>
                    <p>10.3 如本协议的任何条款被认定为无效或不可执行，不影响其余条款的有效性和可执行性。</p>
                    <p>10.4 我们未能行使或执行本协议任何权利或规定，不构成对该权利或规定的放弃。</p>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-semibold mb-4 text-primary">十一、联系我们</h2>
                  <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                    <p>如您对本协议有任何疑问或建议，请通过以下方式联系我们：</p>
                    <p>电子邮件：contact@aidimsum.com</p>
                    <p className="font-semibold mt-4">特别提示：您使用我们的服务，即表示您已阅读、理解并同意本协议的所有条款。如您不同意本协议中的任何内容，请停止使用我们的服务。</p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 