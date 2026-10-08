package app.lector.classroom;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClassroomMemberRepository extends JpaRepository<ClassroomMember, Long> {

    @Query("select m from ClassroomMember m join fetch m.student where m.classroom.id = :classroomId "
            + "order by m.joinedAt")
    List<ClassroomMember> findByClassroomId(@Param("classroomId") Long classroomId);

    @Query("select m from ClassroomMember m join fetch m.classroom c join fetch c.teacher "
            + "where m.student.id = :studentId order by m.joinedAt desc")
    List<ClassroomMember> findByStudentId(@Param("studentId") Long studentId);

    boolean existsByClassroomIdAndStudentId(Long classroomId, Long studentId);

    Optional<ClassroomMember> findByClassroomIdAndStudentId(Long classroomId, Long studentId);

    long countByClassroomId(Long classroomId);

    /** How many students are in this teacher's classes, each counted once (Classroom billing's seats). */
    @Query("select count(distinct m.student.id) from ClassroomMember m where m.classroom.teacher.id = :teacherId")
    long countStudentsOfTeacher(@Param("teacherId") Long teacherId);

    /** True when the student belongs to a class run by a teacher on the Classroom plan (which grants them Pro). */
    @Query("select count(m) > 0 from ClassroomMember m where m.student.id = :studentId "
            + "and m.classroom.teacher.tier = app.lector.user.Tier.CLASSROOM")
    boolean hasSponsoredMembership(@Param("studentId") Long studentId);

    @Modifying
    @Query("delete from ClassroomMember m where m.classroom.id = :classroomId")
    void deleteByClassroomId(@Param("classroomId") Long classroomId);
}
