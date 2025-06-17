import { Header } from "@/components/layout/header";
import React from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

const mockData = [
  {
    group: 1,
    items: [
      { word: "爱", audio: "oi3", audioUrl: "#", altAudio: false },
      { word: "爱", audio: "ngoi3", audioUrl: "#", altAudio: true },
    ],
  },
  {
    group: 2,
    items: [
      { word: "爱", audio: "oi3", audioUrl: "#", altAudio: false },
      { word: "爱", audio: "ngoi3", audioUrl: "#", altAudio: true },
    ],
  },
  {
    group: 3,
    items: [
      { word: "爱", audio: "oi3", audioUrl: "#", altAudio: false },
      { word: "爱", audio: "ngoi3", audioUrl: "#", altAudio: true },
    ],
  },
];

const buttonClass =
  "rounded-full border border-gray-400 px-6 py-2 text-white bg-transparent hover:bg-gray-700 transition-colors duration-150 mr-2";

export default function DataAnnotationPage() {
  return (
    <>
      <Header />
      <div className="min-h-[calc(100vh-56px)]">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Data Annotation</h1>
            <div className="flex gap-2">
              <button className={buttonClass}>Create</button>
              <button className={buttonClass}>Save</button>
              <button className={buttonClass}>Delete</button>
              <button className={buttonClass}>Batch Upload</button>
              <button className={buttonClass}>Download template</button>
            </div>
          </div>
          <div className="grid gap-8">
            {mockData.map((group) => (
              <Card key={group.group} className="p-6 bg-card transition-all duration-200 hover:shadow-lg">
                <Table className="w-full border-separate border-spacing-0 rounded-lg overflow-hidden bg-transparent text-white text-base">
                  <TableHeader>
                    <TableRow className="text-gray-300 bg-[#23242a] text-base text-white">
                      <TableHead className="border border-gray-600 px-4 py-2 w-24 text-center text-base text-white">字</TableHead>
                      <TableHead className="border border-gray-600 px-4 py-2 w-64 text-center text-base text-white">粤音</TableHead>
                      <TableHead className="border border-gray-600 px-4 py-2 w-64 text-center text-base text-white">详情</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((item, i) => (
                      <TableRow key={i} className="text-white text-base">
                        <TableCell className="border border-gray-600 px-4 py-3 text-center text-lg">{item.word}</TableCell>
                        <TableCell className="border border-gray-600 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span>
                              <svg className="inline-block w-6 h-6 mr-1 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6h13M9 6l-7 7m0 0l7 7" /></svg>
                            </span>
                            <span>音节：{item.audio}</span>
                          </div>
                        </TableCell>
                        <TableCell className="border border-gray-600 px-4 py-3 text-center">
                          {["查看", "编辑", "删除", "审核"].map((action, j) => (
                            <React.Fragment key={action}>
                              <a
                                href="#"
                                className={
                                  `mx-1 transition-colors duration-150 cursor-pointer text-gray-300 hover:text-purple-400`
                                }
                              >
                                {action}
                              </a>
                              {j !== 3 && <span className="text-gray-500">|</span>}
                            </React.Fragment>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
