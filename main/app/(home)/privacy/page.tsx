"use client";

import { Header } from "@/components/layout/header";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <>
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
            <h1 className="text-3xl font-bold text-foreground mb-8 text-center">
              Dim Sum AI Lab网站隐私政策
            </h1>

            <div className="prose prose-gray dark:prose-invert max-w-none">
              <div className="mb-8 text-muted-foreground">
                <p>
                  欢迎您访问 Dim Sum AI Lab
                  (下称&quot;本实验室&quot;、&quot;我们&quot;或&quot;平台&quot;)
                  的官方网站 https://www.aidimsum.com/
                  。我们致力于探索粤语（Cantonese）与人工智能的结合，构建粤语语料库及应用生态，促进粤语的保护、传承与创新。
                </p>
                <p className="mt-4">
                  我们深知个人信息对您的重要性，并致力于保护您的隐私。本《Dim
                  Sum AI Lab
                  隐私政策》（下称&quot;本政策&quot;）旨在向您说明我们如何收集、使用、存储、共享、转让和保护您的个人信息，以及您享有的相关权利。本政策适用于您访问和使用本网站及我们提供的相关服务（包括但不限于信息浏览、社区交流、语料贡献、工具使用等）。
                </p>
                <p className="mt-4">
                  请您在使用我们的服务前，仔细阅读并充分理解本政策全部内容，特别是以粗体标识的条款。一旦您开始访问本网站或使用我们的服务，即表示您已充分理解并同意本政策。如果您不同意本政策的任何内容，请立即停止使用我们的服务。
                </p>
              </div>

              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 text-primary">
                  本政策将帮助您了解以下内容：
                </h2>
                <div className="bg-muted/50 rounded-lg p-6">
                  <ul className="list-disc pl-6 space-y-2">
                    <li>我们如何收集和使用您的个人信息</li>
                    <li>我们如何进行粤语语料贡献的数据处理（重要）</li>
                    <li>我们如何使用 Cookie 和同类技术</li>
                    <li>我们如何共享、转让、公开披露您的个人信息</li>
                    <li>我们如何存储和保护您的个人信息</li>
                    <li>您管理个人信息的权利</li>
                    <li>我们如何处理未成年人的个人信息</li>
                    <li>本政策如何更新</li>
                    <li>如何联系我们</li>
                  </ul>
                </div>
              </div>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-primary">
                  一、我们如何收集和使用您的个人信息
                </h2>
                <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                  <p>
                    我们会遵循正当、合法、必要的原则，出于实现本实验室使命和为您提供服务的目的，收集和使用您的个人信息：
                  </p>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      (一) 网站基本运行与安全保障
                    </h3>
                    <p>
                      为保障网站正常运行和网络安全，我们会自动收集您的设备信息（如设备型号、操作系统版本、浏览器类型、唯一设备标识符）、网络信息（如IP地址）以及您的服务日志信息（如访问时间、浏览页面记录、点击记录）。这些信息是提供服务和保障安全所必需的。
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      (二) 用户注册与账户管理
                    </h3>
                    <p>
                      当您注册成为本平台用户或社区成员时，您可能需要提供您的昵称、电子邮箱地址或手机号码，并创建密码。您还可以选择性提供如您的研究领域、技术专长、所属机构/学校等信息，以便我们更好地了解社区成员构成和促进交流。根据法律法规要求，我们可能需要您进行实名认证。
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">(三) 社区交流与互动</h3>
                    <p>
                      当您在平台的社区板块（如论坛、评论区）发布信息、评论或与其他用户互动时，我们会收集您主动发布的信息内容。请注意，您在公开区域发布的信息可能会被其他用户查看。
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      (四) 使用AI工具或服务
                    </h3>
                    <p>
                      如您使用本平台提供的粤语AI工具或服务（如演示、测试应用），您可能需要输入相关的文本、语音或其他指令信息。我们会收集并处理这些信息，以执行您的指令并返回结果。我们会记录您的服务使用历史，以便您查阅。
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">(五) 参与研究或项目</h3>
                    <p>
                      如您参与本实验室的研究项目或特定活动，我们可能会根据项目需要，在另行告知并获得您同意的情况下，收集其他必要信息。
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">(六) 沟通与支持</h3>
                    <p>
                      当您通过邮件、在线表单或其他方式联系我们寻求支持或提出咨询时，我们会收集您的联系信息（如姓名、邮箱、电话）和通信内容，以便响应您的请求。
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">(七) 服务改进与研究</h3>
                    <p>
                      我们可能使用收集到的信息（如日志信息、服务使用记录、用户反馈，但不包括未经您明确同意用于此目的的语料贡献内容）进行内部数据分析和研究，以改进网站功能、优化服务体验、支持粤语AI技术发展。在此过程中，我们会尽可能采取匿名化或去标识化处理。
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">(八) 征得同意的例外</h3>
                    <p>
                      根据相关法律法规，在特定情形下收集和使用您的个人信息无需征得您的同意。
                    </p>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-primary">
                  二、我们如何进行粤语语料贡献的数据处理
                </h2>
                <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                  <p>
                    建设大规模、高质量的粤语语料库是本实验室的核心工作之一。我们可能通过本平台或其他渠道邀请您自愿贡献粤语相关的语料数据。此过程涉及的个人信息处理将遵循以下原则：
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>自愿原则：您参与语料贡献完全基于自愿。</li>
                    <li>
                      明确告知与单独同意：在您贡献任何语料数据（特别是语音、视频、包含个人身份或对话内容的文本等可能涉及个人信息甚至敏感个人信息的语料）前，我们会通过专门的告知书、页面提示等方式，清晰、详细地向您说明：
                    </li>
                    <ul className="list-disc pl-6 mt-2 space-y-2">
                      <li>收集的数据类型（如文本、音频、视频、标注信息）</li>
                      <li>
                        收集和使用的目的（明确用于粤语语言研究、AI模型训练、语料库建设等）
                      </li>
                      <li>
                        数据的处理方式（如存储、标注、转录、可能的匿名化或去标识化处理）
                      </li>
                      <li>
                        数据的潜在使用者（如本实验室研究人员、合作机构研究人员、经授权的开发者等）
                      </li>
                      <li>可能的风险（如隐私泄露风险，尽管我们会尽力保护）</li>
                      <li>您的权利（如下文所述）</li>
                    </ul>
                    <li>
                      数据使用：您贡献的语料数据将严格用于告知的目的。我们不会将其用于与粤语研究和AI发展无关的商业活动，除非另行获得您的明确同意。
                    </li>
                    <li>
                      用户权利与控制：我们将努力为您提供管理您所贡献语料数据的途径。但请您理解，由于语料库建设和AI模型训练的特性，一旦您的数据被处理（如匿名化、聚合、用于模型训练）并纳入大型数据集中，可能难以或无法再单独识别、访问、更正或删除您的特定贡献部分。我们会在征求您同意前明确告知您这些限制。您撤回语料贡献同意的决定，不影响撤回前基于您同意已进行的数据处理活动。
                    </li>
                    <li>
                      安全保障：我们将采取严格的技术和管理措施保护您贡献的语料数据的安全，防止泄露、篡改或丢失。
                    </li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-primary">
                  三、我们如何使用Cookie和同类技术
                </h2>
                <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                  <p>
                    我们使用Cookie和类似技术（如本地存储）来确保网站正常运行、存储您的偏好设置（如语言选择）、简化登录过程、以及进行流量分析。您可以通过浏览器设置管理或禁用Cookie，但这可能影响您对本网站部分功能的使用。
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-primary">
                  四、我们如何共享、转让、公开披露您的个人信息
                </h2>
                <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                  <h3 className="text-lg font-medium">(一) 共享</h3>
                  <p>我们不会与外部第三方共享您的个人信息，但以下情况除外：</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      获得您的明确同意：特别是对于语料库数据的共享，我们会根据您在贡献时的同意范围进行。例如，根据您的授权，我们可能与学术研究机构、认证的开发者共享（通常是经过处理或在严格协议下）部分语料数据用于非商业性研究或应用开发。
                    </li>
                    <li>履行法定义务所必需。</li>
                    <li>
                      与服务提供商共享：为实现本政策所述目的，我们可能需要与提供技术支持（如云存储、数据处理、安全服务）的服务提供商共享必要的个人信息。我们会要求他们严格遵守我们的数据保护要求。
                    </li>
                    <li>
                      社区内部共享：您在社区公开区域发布的信息会被其他用户看到。
                    </li>
                  </ul>

                  <h3 className="text-lg font-medium mt-6">(二) 转让</h3>
                  <p>
                    原则上我们不会转让您的个人信息，除非获得您的明确同意，或者在涉及合并、收购、资产转让或类似交易时，我们会要求新的持有方继续受本政策约束。
                  </p>

                  <h3 className="text-lg font-medium mt-6">(三) 公开披露</h3>
                  <p>
                    我们仅在获得您明确同意或法律强制要求的情况下，才会公开披露您的个人信息。我们不会公开披露您贡献的原始语料数据，除非经过处理（如完全匿名化）或获得您的另行明确同意。
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-primary">
                  五、我们如何存储和保护您的个人信息
                </h2>
                <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      存储地点：我们在中华人民共和国境内收集和产生的个人信息，将存储在中华人民共和国境内。
                    </li>
                    <li>
                      存储期限：我们仅在为实现本政策所述目的所必需的最短时间内保留您的个人信息，法律法规另有强制要求的除外。对于语料贡献数据，其存储期限可能较长，以满足长期研究和语料库维护的需要，我们会在征求您同意时说明。
                    </li>
                    <li>
                      安全保护：我们已采取符合业界标准的安全防护措施保护您的个人信息安全，特别是对于您贡献的粤语语料数据，我们会采用加密、访问控制、脱敏（如适用）等手段加强保护。我们会定期进行安全审计和风险评估。如发生个人信息安全事件，我们将依法履行告知和报告义务。
                    </li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-primary">
                  六、您管理个人信息的权利
                </h2>
                <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                  <p>您依法享有以下权利：</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>访问权：您有权访问您的账户信息等个人信息。</li>
                    <li>更正权：您发现信息有误时，有权要求更正。</li>
                    <li>
                      删除权：在特定情形下（见
                      《中华人民共和国个人信息保护法》第四十七条），您可以请求删除您的个人信息。
                    </li>
                    <li>
                      撤回同意权：您有权撤回对处理您个人信息的同意。对于语料贡献，撤回同意的方式和影响请见本政策第二部分第4条。
                    </li>
                    <li>注销账户权：您有权注销您的平台账户。</li>
                    <li>
                      获取信息副本权：您有权获取您的个人基本资料、身份信息等的副本。
                    </li>
                    <li>
                      解释说明权：您有权要求我们就个人信息处理规则进行解释说明。
                    </li>
                    <li>投诉权：您有权向监管部门投诉或向我们反馈。</li>
                  </ul>
                  <p>
                    您可以通过【请说明用户行使权利的具体途径，例如：账户设置页面、联系邮箱等】来行使您的权利。为保障安全，我们可能需要验证您的身份。我们将在十五个工作日内响应您的请求。
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-primary">
                  七、我们如何处理未成年人的个人信息
                </h2>
                <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                  <p>
                    本平台主要面向成年人。我们不面向未满14周岁的儿童提供服务。若您是未成年人，请在您的父母或其他监护人的指导下共同阅读本政策，并在获得监护人同意后使用我们的服务或提供个人信息。如果我们发现在未事先获得可证实的监护人同意的情况下收集了未成年人的个人信息，我们会设法尽快删除相关数据。
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-primary">
                  八、本政策如何更新
                </h2>
                <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                  <p>
                    本政策可能适时更新。未经您明确同意，我们不会削减您按照本政策所应享有的权利。任何更新我们都会在本页面发布。对于重大变更，我们会提供更显著的通知（如网站公告、弹窗等）。
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-primary">
                  九、如何联系我们
                </h2>
                <div className="space-y-4 bg-muted/50 rounded-lg p-6">
                  <p>
                    如果您对本隐私政策或您的个人信息相关事宜有任何疑问、意见或建议，或者希望行使您的法定权利，请通过以下方式联系我们：
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>联系邮箱：privacy@aidimsum.com</li>
                  </ul>
                  <p>
                    我们将尽快审核所涉问题，并在验证您的用户身份后十五个工作日内予以回复。
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
