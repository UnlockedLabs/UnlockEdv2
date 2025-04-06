import useSWR from 'swr';
import { AxiosError } from 'axios';
import {
    OpenContentResponse,
    ResidentAccountAction,
    ResidentEngagementProfile,
    ServerResponseOne,
    ValidResident
} from '@/common';
import EngagementRateGraph from '@/Components/EngagementRateGraph';
import { ResponsiveContainer } from 'recharts';
import StatsCard from '@/Components/StatsCard';
import {
    UserCircleIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useNavigate, useParams } from 'react-router-dom';
import ClampedText from '@/Components/ClampedText';
import DropdownControl from '@/Components/inputs/DropdownControl';
import {
    closeModal,
    showModal,
    TextModalType,
    TextOnlyModal
} from '@/Components/modals';
import { useRef, useState } from 'react';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { VerifyResidentModal } from '@/Components/modals/VerfiyResidentModal';
import API from '@/api/api';
import ULIComponent from '@/Components/ULIComponent';
import { canSwitchFacility, useAuth } from '@/useAuth';

const ResidentProfile = () => {
    const { user } = useAuth();
    const { user_id } = useParams<{ user_id: string }>();
    const {
        data,
        error,
        mutate: mutateResident,
        isLoading
    } = useSWR<ServerResponseOne<ResidentEngagementProfile>, AxiosError>(
        `/api/users/${user_id}/profile`
    );
    const [controlKey, setControlKey] = useState<number>(0);
    const [resident, setResident] = useState<ValidResident | null>();
    const metrics = data?.data;
    const isLessAvgThanOneHour =
        (metrics?.activity_engagement.total_hours_active_weekly ?? 0) < 1;
    const isLessThanOneHour =
        (metrics?.activity_engagement.total_hours_engaged ?? 0) < 1;

    const avgNumber = isLessAvgThanOneHour
        ? (
              metrics?.activity_engagement.total_minutes_active_weekly ?? 0
          ).toFixed(2)
        : (metrics?.activity_engagement.total_hours_active_weekly ?? 0).toFixed(
              2
          );

    const weekNumber = isLessThanOneHour
        ? (metrics?.activity_engagement.total_minutes_engaged ?? 0).toFixed(2)
        : (metrics?.activity_engagement.total_hours_engaged ?? 0).toFixed(2);

    const avgLabel = isLessAvgThanOneHour ? 'Min' : 'Hrs';

    const weekLabel = isLessThanOneHour ? 'Minutes' : 'Hours';

    const navigate = useNavigate();
    const handleShowLibraryClick = (id: number) => {
        navigate(`/viewer/libraries/${id}`);
    };

    //start transfer logic
    const verifyResidentModal = useRef<HTMLDialogElement>(null);
    const confirmTransferModal = useRef<HTMLDialogElement>(null);
    const checkResponse = useCheckResponse({
        mutate: mutateResident,
        refModal: confirmTransferModal
    });
    function executeAccountAction(val: string) {
        switch (val) {
            case 'transfer':
                showModal(verifyResidentModal);
                break;
            case 'delete':
                console.log('no delete logic exists');
                break;
            default:
                break;
        }
        setControlKey(controlKey + 1);
    }
    function openConfirmTransfer(user: ValidResident) {
        setResident(user);
        showModal(confirmTransferModal);
    }
    async function transferResident() {
        const response = await API.patch(`users/resident-transfer`, {
            trans_facility_id: resident?.trans_facility_id,
            user_id: resident?.user.id,
            curr_facility_id: resident?.user.facility_id
        });
        checkResponse(
            response.success,
            'Unable to transfer resident',
            'Transferred resident successfully'
        );
        if (response.success) {
            const resp = await API.put<null, object>(
                `admin/facility-context/${resident?.trans_facility_id}`,
                {}
            );
            if (resp.success) {
                window.location.reload();
            }
        }
    }
    //end transfer logic
    return (
        <>
            <div className="overflow-x-hidden px-5 pb-4">
                {error && <div>Error loading data</div>}
                {!data || (isLoading && <div>Loading...</div>)}
                {data && metrics && (
                    <>
                        <div className="flex flex-row gap-6 items-stretch">
                            <div className="w-[300px] flex flex-col gap-4">
                                <div className="card p-4 overflow-hidden flex-1 h-full text-grey-4">
                                    <div className="justify-items-center">
                                        <UserCircleIcon className="w-[80px] h-[80px]" />
                                    </div>
                                    <div className="mt-auto">
                                        <div className="text-2xl text-center">
                                            {metrics?.user.name_first}{' '}
                                            {metrics?.user.name_last}
                                        </div>
                                        <div className="text-base">
                                            <div className="grid grid-cols-2">
                                                <p>Username</p>
                                                <div className="flex flex-row justify-between">
                                                    <p>:</p>
                                                    {metrics.user.username}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2">
                                                <p>DOC ID</p>
                                                <div className="flex flex-row justify-between">
                                                    <p>:</p>
                                                    {metrics.user.doc_id}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2">
                                                <p>Joined</p>
                                                <div className="flex flex-row justify-between">
                                                    <p>:</p>
                                                    {metrics?.user.created_at
                                                        ? new Date(
                                                              metrics.activity_engagement.joined
                                                          ).toLocaleDateString(
                                                              'en-US',
                                                              {
                                                                  year: 'numeric',
                                                                  month: 'short',
                                                                  day: 'numeric'
                                                              }
                                                          )
                                                        : 'No Date Available'}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2">
                                                <p>Last Active</p>
                                                <div className="flex flex-row justify-between">
                                                    <p>:</p>
                                                    {metrics.activity_engagement
                                                        .last_active_date
                                                        ? new Date().toLocaleDateString(
                                                              'en-US',
                                                              {
                                                                  year: 'numeric',
                                                                  month: 'short',
                                                                  day: 'numeric'
                                                              }
                                                          )
                                                        : 'N/A'}
                                                </div>
                                            </div>
                                            {user && canSwitchFacility(user) ? (
                                                <>
                                                    <div className="grid grid-cols-2">
                                                        <div className="col-span-2 mt-2">
                                                            <DropdownControl
                                                                key={controlKey}
                                                                useLabel={true}
                                                                label="Manage Account"
                                                                enumType={
                                                                    ResidentAccountAction
                                                                }
                                                                customCallback={
                                                                    executeAccountAction
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                ''
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Chart */}
                            <div className="flex-1 flex flex-col gap-4">
                                <div className="card card-row-padding overflow-hidden h-full flex flex-col">
                                    <h1 className="">
                                        {metrics?.user.name_first +
                                            "'s Recent Activity"}
                                    </h1>
                                    <div className=" items-stretch">
                                        <div className="w-full h-[240px] overflow-visible">
                                            <ResponsiveContainer
                                                className="w-full h-full overflow-visible pb-10"
                                                width="100%"
                                                height="100%"
                                                debounce={500}
                                            >
                                                <EngagementRateGraph
                                                    data={
                                                        metrics?.session_engagement ??
                                                        []
                                                    }
                                                    viewType="userEngagement"
                                                />
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Cards */}
                        <div className="w-[1/2] grid grid-cols-3 gap-4 mb-6 mt-6">
                            <StatsCard
                                title="Days Active"
                                number={metrics.activity_engagement.total_active_days_monthly.toFixed(
                                    0
                                )}
                                label="Days"
                                tooltip="Total days active in UnlockEd"
                                useToLocaleString={false}
                            />
                            <StatsCard
                                title="Avg Time Per Week"
                                number={
                                    parseFloat(avgNumber) === 0
                                        ? '0'
                                        : parseFloat(avgNumber) < 1
                                          ? '<1'
                                          : avgNumber
                                }
                                label={avgLabel}
                                tooltip="Average time spent in UnlockEd per week"
                                useToLocaleString={false}
                            />
                            <StatsCard
                                title="Total Time This Week"
                                number={
                                    parseFloat(weekNumber) === 0
                                        ? '0'
                                        : parseFloat(weekNumber) < 1
                                          ? '<1'
                                          : weekNumber
                                }
                                label={weekLabel}
                                tooltip="Total time spent in UnlockEd this week"
                            />
                        </div>
                        {/* Tables */}
                        <div className="grid grid-cols-2 gap-3 mb-6 mt-6">
                            <div className="card pt-2 px-3">
                                <div className="text-teal-4 text-center text-lg font-semibold">
                                    Top 5 Most Viewed Libraries
                                </div>
                                <table className="table-2 mb-4">
                                    <thead>
                                        <tr className="grid-col-2">
                                            <th className="justify-self-start">
                                                Library Name
                                            </th>
                                            <th># Hours</th>
                                        </tr>
                                    </thead>
                                    <tbody className="">
                                        {metrics.top_libraries.map(
                                            (items: OpenContentResponse) => {
                                                return (
                                                    <tr
                                                        className="justify-items-center cursor-pointer"
                                                        key={items.content_id}
                                                        onClick={() =>
                                                            handleShowLibraryClick(
                                                                items.content_id
                                                            )
                                                        }
                                                    >
                                                        <td className="justify-self-start">
                                                            {items.is_featured
                                                                ? `* ${
                                                                      items.title ??
                                                                      'Untitled'
                                                                  }`
                                                                : items.title ??
                                                                  'Untitled'}
                                                        </td>
                                                        <td className="justify-self-end">
                                                            {items.total_hours.toFixed(
                                                                2
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        )}
                                    </tbody>
                                </table>
                                <div className="border-t border-grey-300 mt-2"></div>
                                <p className="text-xs text-grey-4 italic">
                                    * Featured library
                                </p>
                            </div>
                            {/* <div></div> */}
                            <div className="card pt-2 px-3">
                                <div className="text-teal-4 text-center text-lg font-semibold border-b border-b-grey-300">
                                    Recently Watched Videos
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-4 mt-4">
                                    {metrics.recent_videos.length > 0 ? (
                                        metrics.recent_videos.map(
                                            (item, index) => (
                                                <div
                                                    key={index}
                                                    className="flex flex-col items-center"
                                                >
                                                    <img
                                                        className="h-8 object-contain"
                                                        src={
                                                            item.thumbnail_url ??
                                                            ''
                                                        }
                                                        alt={
                                                            item.title ??
                                                            'Untitled'
                                                        }
                                                    />
                                                    <ClampedText
                                                        className="text-xs"
                                                        as={'span'}
                                                        lines={2}
                                                    >
                                                        {item.title ??
                                                            'Untitled'}
                                                    </ClampedText>
                                                </div>
                                            )
                                        )
                                    ) : (
                                        <div className="col-span-2 text-center">
                                            No Videos Found
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
            <VerifyResidentModal
                target={metrics}
                onSuccess={openConfirmTransfer}
                ref={verifyResidentModal}
                mutate={mutateResident}
            />
            <TextOnlyModal
                ref={confirmTransferModal}
                type={TextModalType.Confirm}
                width="max-w-2xl"
                title={'Confirm Transfer'}
                text={
                    <div>
                        <>
                            <table className="body">
                                <tbody>
                                    <tr>
                                        <td className="font-bold text-right">
                                            Resident Name:
                                        </td>
                                        <td>
                                            {resident?.user.name_first}{' '}
                                            {resident?.user.name_last}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold text-right">
                                            ID:
                                        </td>
                                        <td>{resident?.user.doc_id}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold text-right">
                                            Current Facility:
                                        </td>
                                        <td>{resident?.transfer_from}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-bold text-right">
                                            New Facility:
                                        </td>
                                        <td>{resident?.transfer_to}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p className="body font-bold py-2">
                                You are about to transfer this resident's
                                account.
                            </p>
                            <ul className="body list-disc list-outside pl-5">
                                <li>
                                    Resident account will be removed from the
                                    current facility.
                                </li>
                                <li>
                                    Resident will be unenrolled from any active
                                    classes or programs.
                                </li>
                                {resident?.program_names &&
                                    resident?.program_names.length != 0 && (
                                        <>
                                            <li>
                                                Resident is enrolled in the
                                                following classes that are not
                                                available at facility being
                                                transferred to:
                                                <ul className="list-disc list-outside pl-5">
                                                    {resident?.program_names.map(
                                                        (name) => (
                                                            <li key={name}>
                                                                {name}
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            </li>
                                        </>
                                    )}
                                <li>
                                    Resident account will be added to the new
                                    facility.
                                </li>
                                <li>
                                    Staff must re-enroll resident in available
                                    programs at new facility.
                                </li>
                                <li>
                                    Account history will remain on the resident
                                    profile.
                                </li>
                                <li>
                                    Resident favorites and history will be
                                    saved.
                                </li>
                            </ul>
                            <div className="body py-4 inline-flex items-center gap-1">
                                <ULIComponent icon={ExclamationTriangleIcon} />{' '}
                                This action cannot be undone.
                            </div>
                        </>
                    </div>
                }
                onSubmit={() => void transferResident()}
                onClose={() => {
                    closeModal(confirmTransferModal);
                    setResident(null);
                }}
            />
        </>
    );
};

export default ResidentProfile;
