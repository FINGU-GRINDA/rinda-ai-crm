import type React from "react"
import type { Customer } from "../types"
import { DataTable, type TableColumn } from "./DataTable"
import { IconBrain, IconFileText } from "./Icons"
import { StatusBadge } from "./ui/StatusBadge"

interface TableViewProps {
  customers: Customer[]
  selectedCustomerId: string | null
  onSelectCustomer: (customerId: string) => void
  selectedRows: Set<string>
  onSelectionChange: (selectedIds: Set<string>) => void
}

export const TableView: React.FC<TableViewProps> = ({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  selectedRows,
  onSelectionChange,
}) => {
  const columns: TableColumn<Customer>[] = [
    {
      id: "name",
      label: "고객명",
      width: 200,
      sortable: true,
      render: (customer) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-900">{customer.name}</span>
          {customer.enrichedData && (
            <IconBrain className="w-3.5 h-3.5 text-violet-600" aria-label="회사 정보 수집 완료" />
          )}
        </div>
      ),
    },
    {
      id: "status",
      label: "상태",
      width: 120,
      sortable: true,
      render: (customer) => <StatusBadge kind="status" value={customer.status} />,
    },
    {
      id: "industry",
      label: "산업",
      width: 150,
      sortable: true,
      render: (customer) => <span className="text-neutral-600">{customer.industry}</span>,
    },
    {
      id: "website",
      label: "웹사이트",
      width: 180,
      render: (customer) => (
        <a
          href={`https://${customer.website}`}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {customer.website}
        </a>
      ),
    },
    {
      id: "proposals",
      label: "제안서",
      width: 80,
      sortable: true,
      render: (customer) => (
        <div className="flex items-center gap-1">
          {customer.proposals.length > 0 ? (
            <>
              <IconFileText className="w-3.5 h-3.5 text-neutral-600" />
              <span className="text-neutral-700">{customer.proposals.length}</span>
            </>
          ) : (
            <span className="text-neutral-400">-</span>
          )}
        </div>
      ),
    },
    {
      id: "notes",
      label: "메모",
      width: 250,
      render: (customer) => (
        <span className="text-neutral-600 truncate block max-w-[250px]">
          {customer.notes || "-"}
        </span>
      ),
    },
  ]

  return (
    <div className="h-full w-full">
      <DataTable
        data={customers}
        columns={columns}
        keyExtractor={(customer) => customer.id}
        onRowClick={(row) => onSelectCustomer(row.id)}
        selectedRows={selectedRows}
        onSelectionChange={onSelectionChange}
        emptyMessage="아직 등록된 고객이 없습니다"
      />
    </div>
  )
}
