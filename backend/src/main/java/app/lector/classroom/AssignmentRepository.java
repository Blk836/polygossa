package app.lector.classroom;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssignmentRepository extends JpaRepository<Assignment, Long> {

    @Query("select a from Assignment a join fetch a.text where a.classroom.id = :classroomId "
            + "order by a.assignedAt desc")
    List<Assignment> findByClassroomId(@Param("classroomId") Long classroomId);

    @Query("""
            select count(a) > 0 from Assignment a
            where a.text.id = :textId and (a.classroom.teacher.id = :userId or exists (
                select m from ClassroomMember m where m.classroom = a.classroom and m.student.id = :userId))
            """)
    boolean isAssignedTo(@Param("textId") Long textId, @Param("userId") Long userId);

    @Modifying
    @Query("delete from Assignment a where a.text.id = :textId")
    void deleteByTextId(@Param("textId") Long textId);

    @Modifying
    @Query("delete from Assignment a where a.classroom.id = :classroomId")
    void deleteByClassroomId(@Param("classroomId") Long classroomId);
}
