import {
  BOOKING_STATUS_CLASS,
  BOOKING_STATUS_LABEL,
  CONTRACT_STATUS_CLASS,
  CONTRACT_STATUS_LABEL,
  DOC_STATUS_CLASS,
  DOC_STATUS_LABEL,
  VEHICLE_STATUS_CLASS,
  VEHICLE_STATUS_LABEL,
  type BookingStatus,
  type ContractStatus,
  type DocStatus,
  type VehicleStatus,
} from "@/lib/booking-types";

/** ป้ายสถานะทั้ง 4 ชุดของใบจอง — สีกับข้อความมาจากที่เดียวกันทุกหน้า */

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`badge whitespace-nowrap ${BOOKING_STATUS_CLASS[status]}`}>
      {BOOKING_STATUS_LABEL[status]}
    </span>
  );
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <span className={`badge whitespace-nowrap ${VEHICLE_STATUS_CLASS[status]}`}>
      {VEHICLE_STATUS_LABEL[status]}
    </span>
  );
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span className={`badge whitespace-nowrap ${CONTRACT_STATUS_CLASS[status]}`}>
      {CONTRACT_STATUS_LABEL[status]}
    </span>
  );
}

export function DocStatusBadge({ status }: { status: DocStatus }) {
  return (
    <span className={`badge whitespace-nowrap ${DOC_STATUS_CLASS[status]}`}>
      {DOC_STATUS_LABEL[status]}
    </span>
  );
}
