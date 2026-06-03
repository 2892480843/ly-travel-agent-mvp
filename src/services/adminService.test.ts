import { describe, expect, it } from "vitest";
import { describeAdminFilterScope, filterAdminRows, filterReviewRows, hasActiveAdminFilters } from "./adminService";

const rows = [
  ["武昌城市酒店入驻", "武昌城市酒店", "商户入驻", "资质材料需复核", "待审核", "2026-06-02 10:18"],
  ["黄鹤楼演示票务活动页", "张运营", "内容发布", "需标注 sandbox 非真实库存/支付", "待审核", "2026-06-02 09:42"],
  ["江汉关城市礼物店", "孙悦", "商户入驻", "地址异常", "已驳回", "2026-05-24 14:05"]
];

describe("adminService", () => {
  it("filters review rows by review status", () => {
    expect(filterReviewRows(rows, { keyword: "", scenic: "全部景区", status: "待审核" })).toHaveLength(2);
    expect(filterReviewRows(rows, { keyword: "", scenic: "全部景区", status: "已发布" })).toHaveLength(0);
  });

  it("filters review rows by keyword and scenic object", () => {
    expect(filterReviewRows(rows, { keyword: "sandbox", scenic: "黄鹤楼", status: "待审核" })).toEqual([rows[1]]);
    expect(filterReviewRows(rows, { keyword: "", scenic: "湖北省博物馆", status: "全部状态" })).toHaveLength(0);
  });

  it("filters generic admin rows by keyword, scenic and status columns", () => {
    const campaignRows = [
      ["江滩夜游周末线", "本地游/夜游季", "进行中", "128,764"],
      ["端午民俗文化节", "节庆/热门", "待上线", "-"],
      ["黄鹤楼观江打卡季", "主题/摄影", "已结束", "96,532"]
    ];
    const knowledgeRows = [
      ["黄鹤楼演示票务多少钱？", "门票政策", "官方整理", "2026-05-24 10:15", "已发布"],
      ["下雨天可以去哪里玩？", "游玩建议", "用户反馈", "2026-05-16 15:05", "待更新"]
    ];

    expect(filterAdminRows(campaignRows, { keyword: "端午", scenic: "全部景区", status: "全部状态" })).toEqual([campaignRows[1]]);
    expect(filterAdminRows(campaignRows, { keyword: "", scenic: "黄鹤楼", status: "已结束" })).toEqual([campaignRows[2]]);
    expect(filterAdminRows(knowledgeRows, { keyword: "下雨天", scenic: "全部景区", status: "待更新" })).toEqual([knowledgeRows[1]]);
  });

  it("describes the active dashboard filter scope", () => {
    expect(describeAdminFilterScope({ keyword: "", scenic: "全部景区", status: "全部状态" })).toBe("全部关键词 / 全部景区 / 全部状态");
    expect(describeAdminFilterScope({ keyword: "sandbox", scenic: "黄鹤楼", status: "待审核", date: "2026-06-02" }, { includeDate: true }))
      .toBe("关键词「sandbox」 / 黄鹤楼 / 待审核 / 2026-06-02");
    expect(hasActiveAdminFilters({ keyword: "", scenic: "全部景区", status: "全部状态" })).toBe(false);
    expect(hasActiveAdminFilters({ keyword: "", scenic: "黄鹤楼", status: "全部状态" })).toBe(true);
  });
});
