import React from "react";
import { useSelector } from "react-redux";
import { ddahTableSelector, setSelectedRows } from "./actions";
import { Ddah, Assignment, Instructor } from "../../../api/defs/types";
import {
    ddahsSelector,
    upsertDdah,
    approveDdah,
} from "../../../api/actions/ddahs";
import { assignmentsSelector } from "../../../api/actions";
import { FaCheck, FaSearch, FaEdit, FaDownload } from "react-icons/fa";

import "./styles.css";
import { Button, Modal, Spinner } from "react-bootstrap";
import { formatDate, formatDownloadUrl } from "../../../libs/utils";
import { DdahEditor } from "../../../components/ddahs";
import { generateHeaderCell } from "../../../components/table-utils";
import { AdvancedFilterTable } from "../../../components/filter-table/advanced-filter-table";
import { useThunkDispatch } from "../../../libs/thunk-dispatch";
import {
    ddahIssues,
    getReadableStatus,
    getRecentActivityDate,
    splitDutyDescription,
} from "./../../../libs/ddah-utils";

export interface RowData {
    id?: number;
    position_code: string;
    last_name: string;
    first_name: string;
    total_hours: number | null;
    status: string | null;
    recent_activity_date: string | null;
    emailed_date: string | null;
    issues: string | null;
    issue_code: "hours_mismatch" | "missing" | null;
}

/**
 * Cell for rendering the status of a DDAH
 *
 * @param {{ original: RowData }} { original }
 * @returns {React.ReactNode}
 */
export function StatusCell({
    row,
    children = null,
}: {
    row: { original: RowData };
    children?: React.ReactNode;
}): JSX.Element {
    const original = row.original;
    // If we have a blank ID, we aren't actually a DDAH (we're an assignment
    // without a DDAH), so don't render anything.
    if (original.id == null) {
        return null as any;
    }
    const readableStatus = getReadableStatus(original as Pick<Ddah, "status">);
    switch ((original as Pick<Ddah, "status">).status) {
        case "accepted":
            return (
                <React.Fragment>
                    {children}
                    <span className="accepted-ddah">{readableStatus}</span>
                </React.Fragment>
            );
        default:
            return (
                <React.Fragment>
                    {children}
                    {readableStatus}
                </React.Fragment>
            );
    }
}

/**
 * Cell for rendering the issues of a DDAH
 *
 * @param {{ original: RowData }} { original }
 * @returns {React.ReactNode}
 */
function IssuesCell({
    row,
}: {
    row: { original: RowData };
}): JSX.Element | null {
    const original = row.original;
    switch (original.issue_code) {
        case "hours_mismatch":
            return <div className="hours-mismatch-ddah">{original.issues}</div>;
        case "missing":
            return <div className="missing-ddah">{original.issues}</div>;
        default:
            return null;
    }
}

/**
 * Cell for previewing a DDAH
 *
 * @param {{ original: RowData }} { original }
 * @returns {React.ReactNode}
 */
export function PreviewCell({
    row,
    onClick = () => {},
}: {
    row: { original: RowData };
    onClick: Function;
}): JSX.Element | null {
    const original = row.original;
    if (original.id == null) {
        return null;
    }
    return (
        <Button
            variant="light"
            size="sm"
            className="mr-2 py-0"
            title="Preview DDAH"
            onClick={() => onClick(original.id)}
        >
            <FaSearch />
        </Button>
    );
}

export function DdahPreviewModal({
    ddah,
    show,
    onHide = () => {},
    onApprove = () => {},
    onEdit = () => {},
}: {
    ddah: Ddah | null;
    show: Boolean;
    onHide?: Function;
    onApprove?: Function;
    onEdit?: Function;
}): React.ReactElement {
    let ddahPreview: React.ReactElement | string = "No DDAH to preview";
    let url: string | null = null;
    if (ddah != null) {
        ddahPreview = <DdahPreview ddah={ddah} />;
        url = `/public/ddahs/${ddah.url_token}.pdf`;
    }
    return (
        <Modal show={show} onHide={onHide} dialogClassName="wide-modal">
            <Modal.Header closeButton>
                <Modal.Title>Previewing DDAH</Modal.Title>
            </Modal.Header>
            <Modal.Body>{ddahPreview}</Modal.Body>
            <Modal.Footer>
                <Button variant="outline-secondary" onClick={() => onHide()}>
                    Close
                </Button>
                <Button variant="outline-info" onClick={() => onEdit(ddah)}>
                    <FaEdit className="mr-2" />
                    Edit
                </Button>
                {url && (
                    <Button
                        title="Download DDAH."
                        variant="link"
                        href={formatDownloadUrl(url)}
                    >
                        <FaDownload className="mr-2" />
                        Download DDAH
                    </Button>
                )}
                <Button onClick={() => onApprove(ddah)}>
                    <FaCheck className="mr-2" />
                    Approve
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

function DdahPreview({ ddah }: { ddah: Ddah }): React.ReactElement {
    const duties = [...ddah.duties];
    duties.sort((a, b) => a.order - b.order);

    const assignment = ddah.assignment;
    const applicant = assignment.applicant;
    const position = assignment.position;
    const instructors = position.instructors;

    return (
        <div className="ddah-preview-container">
            <h4>Description of Duties and Allocation of Hours</h4>
            <h4>
                Position: {position.position_code} ({position.position_title})
            </h4>
            <h4>
                TA: {applicant.first_name} {applicant.last_name}
            </h4>
            <h5>Duties</h5>
            <ul>
                {duties.map((duty) => {
                    const { category, description } = splitDutyDescription(
                        duty.description
                    );
                    return (
                        <li key={duty.order}>
                            <span className="ddah-duty-hours">
                                {category === "note" ? null : duty.hours}
                            </span>
                            <span
                                className={`ddah-duty-category ${category}`}
                            />
                            <span className="ddah-duty-description">
                                {description}
                            </span>
                        </li>
                    );
                })}
                <li>
                    <span className="ddah-duty-hours">{ddah.total_hours}</span>
                    <span className="ddah-duty-description">Total</span>
                </li>
            </ul>
            <div className="signature-area">
                <div>
                    Prepared by {getFormattedInstructorNameList(instructors)}{" "}
                    {ddah.emailed_date
                        ? ` on ${formatDate(ddah.emailed_date)}`
                        : ""}
                </div>
                <div>
                    {ddah.accepted_date
                        ? `Accepted by ${applicant.first_name} ${
                              applicant.last_name
                          } on ${formatDate(ddah.accepted_date)}`
                        : "Not yet accepted"}
                </div>
            </div>
        </div>
    );
}

export function ConnectedDdahEditorModal({
    ddah,
    show,
    onHide = () => {},
}: {
    ddah: Ddah | null;
    show: Boolean;
    onHide?: Function;
}): React.ReactElement {
    const [inProgress, setInProgress] = React.useState(false);
    const dispatch = useThunkDispatch();
    const [newDdah, setNewDdah] = React.useState<Ddah | null>(ddah);

    React.useEffect(() => {
        setNewDdah(ddah);
    }, [ddah]);

    // When a confirm operation is in progress, a spinner is displayed; otherwise
    // it's hidden
    const spinner = inProgress ? (
        <Spinner animation="border" size="sm" className="mr-1" />
    ) : null;

    async function onSave(newDdah: Ddah | null) {
        try {
            if (newDdah) {
                setInProgress(true);
                await dispatch(upsertDdah(newDdah));
            }
        } finally {
            setInProgress(false);
            onHide();
        }
    }

    const editor = ddah ? (
        <DdahEditor
            ddah={newDdah as Ddah}
            editableAssignment={false}
            setDdah={setNewDdah}
        />
    ) : (
        "No DDAH Specified"
    );

    return (
        <Modal show={show} onHide={onHide} dialogClassName="wide-modal">
            <Modal.Header closeButton>
                <Modal.Title>Editing DDAH</Modal.Title>
            </Modal.Header>
            <Modal.Body>{editor}</Modal.Body>
            <Modal.Footer>
                <Button variant="outline-secondary" onClick={() => onHide()}>
                    Cancel
                </Button>
                <Button onClick={() => onSave(newDdah)}>
                    {spinner}
                    Save
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

/**
 * Return a formatted list of instructors, or `"(Unknown)"` if there are none listed.
 */
function getFormattedInstructorNameList(instructors: Instructor[]): string {
    if (instructors.length === 0) {
        return "(Unknown)";
    }
    const names = instructors.map(
        (instructor) => `${instructor.first_name} ${instructor.last_name}`
    );
    try {
        const formatter = new (Intl as any).ListFormat("en", {
            style: "long",
            type: "conjunction",
        });
        return formatter.format(names);
    } catch (e) {
        return names.join(", ");
    }
}

/**
 * Table to view/preview large collections of DDAHs
 *
 * @export
 * @returns
 */
export function ConnectedDdahsTable() {
    let ddahs = useSelector(ddahsSelector) as Ddah[];
    const assignments = useSelector(assignmentsSelector) as Assignment[];
    const selected = useSelector(ddahTableSelector).selectedDdahIds;
    const dispatch = useThunkDispatch();

    const [previewVisible, setPreviewVisible] = React.useState<Boolean>(false);
    const [editVisible, setEditVisible] = React.useState<Boolean>(false);
    const [previewDdah, setPreviewDdah] = React.useState<Ddah | null>(null);

    function setSelected(ids: number[]) {
        // If a row is missing an id, `null` will be used in place of that id.
        // We don't want that value of `null` to mess things up when we use
        // the selected rows in another function.
        dispatch(setSelectedRows(ids.filter((id) => id != null)));
    }

    function onPreviewClick(id: number) {
        setPreviewDdah(ddahs.find((ddah) => ddah.id === id) || null);
        setPreviewVisible(true);
    }

    function WrappedStatusCell(props: any): React.ReactNode {
        const { row, ...rest } = props;
        return (
            <StatusCell row={row} {...rest}>
                <PreviewCell {...props} onClick={onPreviewClick} />
            </StatusCell>
        );
    }

    // The omni-search doesn't work on nested properties, so we need to flatten
    // the data we display before sending it to the table.
    const data = ddahs.map(
        (ddah) =>
            ({
                id: ddah.id,
                position_code: ddah.assignment.position.position_code,
                last_name: ddah.assignment.applicant.last_name,
                first_name: ddah.assignment.applicant.first_name,
                total_hours: ddah.total_hours,
                status: ddah.status || "unsent",
                recent_activity_date: getRecentActivityDate(ddah),
                emailed_date: formatDate(ddah.emailed_date || ""),
                approved: ddah.approved_date ? "Approved" : "",
                readable_status: getReadableStatus(ddah),
                issues: ddahIssues(ddah),
                issue_code: ddahIssues(ddah) ? "hours_mismatch" : null,
            } as RowData)
    );

    // We want to also list all assignments for which there isn't a DDAH.
    // We start by hashing all the existing DDAHs
    const ddahAssignmentIdsHash = {} as { [key: string]: true };
    for (const ddah of ddahs) {
        ddahAssignmentIdsHash[ddah.assignment.id] = true;
    }
    for (const assignment of assignments) {
        // If an offer is rejected or withdrawn, we will never make a DDAH for it.
        // It is important that this is the first check in the loop, since a
        // DDAH might have been created for an offer that becomes withdrawn.
        // In that case, we still don't want it showing up.
        if (
            assignment.active_offer_status === "rejected" ||
            assignment.active_offer_status === "withdrawn"
        ) {
            continue;
        }
        if (ddahAssignmentIdsHash[assignment.id]) {
            // We have an associated DDAH
            continue;
        }
        data.push({
            position_code: assignment.position.position_code,
            last_name: assignment.applicant.last_name || "",
            first_name: assignment.applicant.first_name,
            total_hours: null,
            status: null,
            recent_activity_date: null,
            emailed_date: null,
            issues: "Missing DDAH",
            issue_code: "missing",
        });
    }

    // Sort the table by position_code by default
    data.sort((a, b) => {
        if (a.position_code > b.position_code) {
            return 1;
        } else if (a.position_code < b.position_code) {
            return -1;
        }
        if (a.last_name > b.last_name) {
            return 1;
        } else if (a.last_name < b.last_name) {
            return -1;
        }
        return 0;
    });

    const columns = [
        {
            Header: generateHeaderCell("Position"),
            accessor: "position_code",
        },
        { Header: generateHeaderCell("Last Name"), accessor: "last_name" },
        { Header: generateHeaderCell("First Name"), accessor: "first_name" },
        {
            Header: generateHeaderCell("DDAH Hours"),
            accessor: "total_hours",
            maxWidth: 120,
            style: { textAlign: "right" },
        },
        {
            Header: generateHeaderCell("Status"),
            accessor: "status",
            Cell: WrappedStatusCell,
        },
        {
            Header: generateHeaderCell("Recent Activity"),
            accessor: "recent_activity_date",
        },
        {
            Header: generateHeaderCell("Emailed"),
            accessor: "emailed_date",
        },
        {
            Header: generateHeaderCell("Approved"),
            accessor: "approved",
            maxWidth: 50,
            Cell: ({ value }: any) =>
                value ? (
                    <div className="accepted-ddah">
                        <FaCheck />
                    </div>
                ) : null,
        },
        {
            Header: generateHeaderCell("Issues"),
            accessor: "issues",
            Cell: IssuesCell,
        },
    ];

    return (
        <>
            <ConnectedDdahEditorModal
                ddah={previewDdah}
                show={editVisible}
                onHide={() => setEditVisible(false)}
            />
            <DdahPreviewModal
                ddah={previewDdah}
                show={previewVisible}
                onHide={() => setPreviewVisible(false)}
                onEdit={() => {
                    setPreviewVisible(false);
                    setEditVisible(true);
                }}
                onApprove={async () => {
                    if (previewDdah) {
                        await dispatch(approveDdah(previewDdah));
                    }
                    setPreviewVisible(false);
                }}
            />
            <AdvancedFilterTable
                // The ReactTable types are not smart enough to know that you can use a function
                // for Header, so we will opt out of the type system here.
                columns={columns as any}
                data={data}
                selected={selected}
                setSelected={setSelected}
                filterable={true}
            />
        </>
    );
}
