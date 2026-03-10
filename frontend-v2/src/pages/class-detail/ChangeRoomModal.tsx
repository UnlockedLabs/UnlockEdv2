import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import API from '@/api/api';
import { toast } from 'sonner';
import { Room, ServerResponseMany } from '@/types';

export interface ChangeRoomSession {
  date: string;
  dateLabel: string;
  eventId: number;
  classTime: string;
  dateObj?: Date;
  dayName?: string;
}

interface ChangeRoomModalProps {
  open: boolean;
  onClose: () => void;
  classId: number;
  sessions: ChangeRoomSession[];
  onChanged: () => void;
  applyToFuture?: boolean;
  setApplyToFuture?: (apply: boolean) => void;
  futureSessions?: ChangeRoomSession[];
  showSessionsList?: boolean;
}

export function ChangeRoomModal({
  open,
  onClose,
  classId,
  sessions,
  onChanged,
  applyToFuture,
  setApplyToFuture,
  futureSessions = [],
  showSessionsList = false
}: ChangeRoomModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: roomsResp } = useSWR<ServerResponseMany<Room>>(
    open ? '/api/rooms' : null
  );
  const rooms = roomsResp?.data ?? [];

  useEffect(() => {
    if (open) {
      setSelectedRoomId('');
      setReason('');
    }
  }, [open]);

  const handleApply = async () => {
    if (!selectedRoomId) return;
    setIsSubmitting(true);
    let ok = 0;
    let fail = 0;

    const allSessions = applyToFuture && futureSessions.length > 0
      ? [...sessions, ...futureSessions]
      : sessions;

    for (const s of allSessions) {
      const resp = await API.patch(
        `program-classes/${classId}/events/${s.eventId}`,
        {
          date: s.date,
          is_cancelled: false,
          room_id: Number(selectedRoomId)
        }
      );
      if (resp.success) ok++;
      else fail++;
    }

    if (ok)
      toast.success(
        `Room updated for ${ok} session${ok === 1 ? '' : 's'}`
      );
    if (fail)
      toast.error(
        `Failed to update ${fail} session${fail === 1 ? '' : 's'}`
      );
    onClose();
    onChanged();
    setIsSubmitting(false);
  };

  const useBulkLayout = showSessionsList || sessions.length > 1;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className={useBulkLayout ? 'max-w-2xl' : ''}>
        <DialogHeader>
          <DialogTitle className="text-[#203622]">
            Change Room
          </DialogTitle>
          <DialogDescription>
            {useBulkLayout
              ? `Select a new room for ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`
              : `Change the room for the class scheduled for ${sessions[0]?.dateLabel}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newRoom">New Room</Label>
            <Select
              value={selectedRoomId}
              onValueChange={setSelectedRoomId}
            >
              <SelectTrigger id="newRoom">
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem
                    key={room.id}
                    value={String(room.id)}
                  >
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="room-change-reason">
              Reason for Change
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="room-change-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="room_unavailable">
                  Room Unavailable
                </SelectItem>
                <SelectItem value="maintenance">
                  Maintenance Required
                </SelectItem>
                <SelectItem value="capacity_change">
                  Capacity Change
                </SelectItem>
                <SelectItem value="security_concern">
                  Security Concern
                </SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {setApplyToFuture && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="apply-room-to-future"
                checked={applyToFuture}
                onChange={(e) =>
                  setApplyToFuture(e.target.checked)
                }
                className="size-4 rounded border-gray-300"
              />
              <Label
                htmlFor="apply-room-to-future"
                className="text-sm font-normal cursor-pointer"
              >
                Apply this change to all future sessions
              </Label>
            </div>
          )}

          {applyToFuture && futureSessions.length > 0 && (
            <div>
              <Label className="text-sm font-medium text-[#203622] mb-2 block">
                Sessions to Update
              </Label>
              <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-4 space-y-1">
                {[...futureSessions]
                  .sort(
                    (a, b) =>
                      (a.dateObj?.getTime() ?? 0) -
                      (b.dateObj?.getTime() ?? 0)
                  )
                  .map((sess) => (
                    <div
                      key={sess.date}
                      className="text-sm text-gray-700"
                    >
                      {sess.dayName ?? ''},{' '}
                      {sess.dateObj?.toLocaleDateString(
                        'en-US',
                        {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        }
                      ) ?? sess.dateLabel}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {useBulkLayout && sessions.length > 0 && (
            <div>
              <Label className="text-sm font-medium text-[#203622] mb-2 block">
                Sessions to Update
              </Label>
              <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-4 space-y-1">
                {[...sessions]
                  .sort(
                    (a, b) =>
                      (a.dateObj?.getTime() ?? 0) -
                      (b.dateObj?.getTime() ?? 0)
                  )
                  .map((s) => (
                    <div
                      key={s.date}
                      className="text-sm text-gray-700"
                    >
                      {s.dateObj?.toLocaleDateString(
                        'en-US',
                        {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        }
                      ) ?? s.dateLabel}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              setSelectedRoomId('');
              setReason('');
              if (setApplyToFuture) setApplyToFuture(false);
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              void handleApply();
            }}
            disabled={!selectedRoomId || isSubmitting}
            className="bg-[#556830] hover:bg-[#203622] text-white"
          >
            {isSubmitting ? 'Updating...' : 'Change Room'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
