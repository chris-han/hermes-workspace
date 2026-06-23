| 流程阶段       | 中文   | CAS / 中国会计规范官方定义                              | 更准确英文                             |
| ---------- | ---- | --------------------------------------------- | --------------------------------- |
| 1. 经济业务发生  | 原始凭证 | 记录经济业务发生或完成情况、明确经济责任，并作为记账原始依据的会计凭证           | Source Document / Source Voucher  |
| 2. 会计确认与编制 | 会计分录 | 按照复式记账原理，对每项经济业务确定应借应贷账户及金额的记录                | Journal Entry                     |
| 3. 凭证生成    | 记账凭证 | 会计人员根据审核无误的原始凭证，按照经济业务内容加以归类并据以确定会计分录后填制的会计凭证 | Journal Voucher / Posting Voucher |
| 4. 凭证体系归类  | 会计凭证 | 记录经济业务、明确经济责任、作为登记账簿依据的书面证明；包括原始凭证和记账凭证       | Accounting Voucher                |
| 5. 登账处理    | 凭证过账 | 根据记账凭证将会计分录登记入账簿的过程                           | Posting                           |
| 6. 时序账簿记录  | 日记账  | 按经济业务发生时间顺序逐日逐笔登记的账簿                          | Journal                           |
| 7. 分类汇总账簿  | 总账   | 按总分类账户分类登记全部经济业务的账簿                           | General Ledger                    |

如果按照现代信息系统/REA 语义再进一步抽象，其实会更清晰：

```text id="c2vhg4"
Economic Event
    ↓
Source Voucher（原始凭证）
    ↓
Semantic Interpretation
    ↓
Journal Entry（会计分录）
    ↓
Journal Voucher（记账凭证）
    ↓
Posting（过账）
    ↓
Journal（日记账）
    ↓
General Ledger（总账）
```

这里：

* 原始凭证 = fact evidence
* 会计分录 = accounting interpretation
* 记账凭证 = governance container
* 账簿 = materialized ledger view

这其实非常接近你 Semantier 里的：

```text id="z0ewxw"
REA Event
→ Projection
→ Ledger View
```

其中：

```text id="z8uyz0"
会计分录 / 记账凭证
```

本质已经属于：

> projection artifact

而不是原始事实。
