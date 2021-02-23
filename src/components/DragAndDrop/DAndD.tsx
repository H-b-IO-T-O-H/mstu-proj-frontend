import React, {useEffect, useState} from "react";
import {v4 as uuid} from "uuid";
import {DragDropContext, DropResult} from "react-beautiful-dnd";
import {useHistory} from "react-router-dom";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {faSave} from "@fortawesome/free-solid-svg-icons/faSave";

import ButtonTimetable from "@components/ButtonTimetable";
import ButtonWithInput from "@components/ButtonWithInput";
import AdminPanel from "@components/AdminPanel";

import {buttonsContent, Week} from "@config/config";
import DroppableElem from "@components/DragAndDrop/DroppableElem";
import DraggableArea from "@components/DragAndDrop/DraggableArea";
import DroppableArea from "@components/DragAndDrop/DroppableArea";
import {findNextDay, copy, reorder, checkFill, saveTimetable, Labels} from "@components/DragAndDrop/config";

import "./DAndD.scss"
import {makeGet} from "@utils/network";
import {Urls} from "@config/urls";

type Lesson = {
    lesson_id: string;
    title: string;
    lesson_type: string;
    auditorium: string;
}

const prepareLessons = (lessons: Array<Lesson>) => {
    return lessons.map((lesson) => ({
        id: lesson.lesson_id, ...<DroppableElem isEmpty={lesson.lesson_type === "free"}
                                                sourceIdx={Labels[lesson.lesson_type]}
                                                header={lesson.title}
                                                footer={lesson.auditorium}/>
    }))
}


const prepareWeek = (weekDays: Array<{ day_id: string, day_order: number, lessons: Array<Lesson> }>) => {
    const newList = {};

    weekDays.map((day, index) => {
        if (day.lessons) {
            newList[index] = prepareLessons(day.lessons)
        } else {
            newList[index] = []
        }
    })
    return newList
}


const DragAndDrop = () => {
    const history = useHistory();
    const [deleted, changeDeleted] = useState<{ lessons: Array<string> }>({
        lessons: []
    })
    const [Lists, changeList] = useState<object>({0: []})
    const [dayIdx, changeDayIdx] = useState<number>(1)
    const [areasValue, setAreasValues] = useState({})
    const [inputsValue, setValues] = useState({})

    useEffect(() => {
        makeGet(Urls.timetable.get("IU10-73", 1)).then((response) => {
            console.log("Ответ сервера успешно получен!");
            const savedWeek = prepareWeek(response.data.week.days)
            changeList(savedWeek)
            changeDayIdx(findNextDay(savedWeek))

        }).catch((error) => {
            console.log(error)
            // if (error.response) {
            //     if (error.response.status === 404) {
            //         setUserError(ERROR_AUTHORIZATION);
            //     } else {
            //         setUserError(ERROR_SERVER);
            //     }
            // } else {
            //     setUserError(SERVER_UNAVAILABLE);
            // }
            return;
        });
    }, [])

    const changeArea = React.useCallback((id: string, value: string) => {
        const oldAreas = areasValue
        oldAreas[id] = value
        setAreasValues(oldAreas);
    }, [areasValue]);

    const changeInput = React.useCallback((id: string, value: string) => {
        const oldInputs = inputsValue
        oldInputs[id] = value
        setValues(oldInputs);
    }, [inputsValue]);

    const droppableColumn = React.useMemo(() => (buttonsContent.map((btn, idx) => (
        <ButtonWithInput key={idx} btn={btn} onAreaChange={changeArea} onInputChange={changeInput}
                         inputs={{maxInputLength: 5, maxAreaLength: 50}}/>
    ))), [changeInput, changeArea])

    const onDragEnd = React.useCallback((result: DropResult) => {
        const {source, destination} = result;

        if (!destination) {
            return;
        }
        const newList = {...Lists};

        switch (source.droppableId) {
            case destination.droppableId:
                if (destination.droppableId === "items") {
                    return;
                }
                newList[destination.droppableId] = reorder(
                    Lists[source.droppableId],
                    source.index,
                    destination.index
                )
                break;
            case "items":
                if (Lists[destination.droppableId].length === Week.length) {
                    return;
                }
                const title = areasValue[buttonsContent[source.index].id];
                const auditorium = inputsValue[buttonsContent[source.index].id];
                const isEmpty = buttonsContent[source.index].title === "СР";

                if (!isEmpty && !checkFill(title, auditorium)) {
                    return;
                }

                const draggable = <DroppableElem isEmpty={isEmpty} sourceIdx={source.index}
                                                 header={isEmpty ? "Самостоятельная работа" : title}
                                                 footer={auditorium}/>

                newList[destination.droppableId] = copy(
                    draggable,
                    newList[destination.droppableId],
                    destination.index
                )
                break;
        }
        changeList(newList);
        console.log(Lists)
    }, [Lists, areasValue, inputsValue]);

    const AddList = React.useCallback(() => {
        const idx = findNextDay(Lists)
        if (idx === -1) {
            return;
        }
        const newList = {...Lists};
        newList[idx] = [];
        changeList(newList);
        changeDayIdx(findNextDay(newList));
    }, [Lists]);

    const removeItem = React.useCallback((list: string, index: number) => {
        const newList = {...Lists};
        const id: string = newList[list][index].id
        const deletedLessons: Array<string> = [...deleted.lessons]
        deletedLessons.push(id)
        changeDeleted({lessons: deletedLessons});
        newList[list].splice(index, 1);
        changeList(newList);
    }, [Lists]);

    const removeList = React.useCallback((list: number) => {
        const newList = {...Lists};
        delete newList[list];
        changeList(newList);
        const idx = findNextDay(newList);
        changeDayIdx(idx);
    }, [Lists]);

    return (
        <div className="DAndD text-center">
            <div className="d-flex flex-row">
                <div className="d-none d-sm-block col-sm-4 col-md-5"/>
                <div className="col-md-7">
                    <AdminPanel dayIdx={dayIdx} changeDay={AddList}/>
                </div>
            </div>
            <hr/>
            <div className="d-flex flex-row">
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="col-5">
                        <DroppableArea Lists={Lists} removeList={removeList} removeItem={removeItem}/>
                    </div>
                    <div className="col-7 d-flex">
                        <DraggableArea droppableColumn={droppableColumn}/>
                    </div>
                </DragDropContext>
            </div>
            <hr/>
            <ButtonTimetable
                onChange={() => {
                    saveTimetable(Lists, deleted)
                    //history.replace(Urls.timetable.byId)
                }}
                btn={{id: uuid(), color: "#36a51c"}}
            >
                <div className="d-flex flex-row align-items-center justify-content-around">
                    <FontAwesomeIcon icon={faSave} size={"sm"}/>
                    <div>Save</div>
                </div>
            </ButtonTimetable>
        </div>
    );
}

export default DragAndDrop;
